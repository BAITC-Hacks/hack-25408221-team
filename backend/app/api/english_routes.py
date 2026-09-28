import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from weakref import WeakValueDictionary

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.core.errors import conflict, not_found
from app.english.core.security import (
    create_admin_token,
    create_applicant_token,
    require_admin,
    require_applicant,
    require_platform_key,
)
from app.english.deps import (
    get_asr,
    get_db,
    get_languagetool,
    get_llm,
    get_storage_dep,
    get_verifier,
    get_webhook,
)
from app.english.domain.enums import (
    ApplicantState,
    IeltsVerdict,
    Placement,
    PlacementSource,
    ReviewDecision,
    Section,
    SessionState,
    Stage,
)
from app.english.domain.schemas import (
    AdminLoginIn,
    AdminLoginOut,
    AnswersIn,
    ApplicantCreate,
    ApplicantOut,
    CheckinIn,
    EventsIn,
    IeltsCheckIn,
    IeltsCheckOut,
    MeOut,
    ReviewIn,
)
from app.english.grading.run import grade_session
from app.english.ielts.service import run_ielts_check
from app.english.infra.models import (
    Applicant,
    Checkin,
    IeltsCheck,
    Item,
    ProctorEvent,
    Response,
    Review,
    TestSession,
)
from app.english.proctor.gates import gates_passed, missing_gates
from app.english.proctor.lockdown import verify_seb
from app.english.test_engine.engine import (
    build_form,
    client_view,
    expire_section,
    get_current_items,
    is_past_deadline,
    start_next_section,
    submit_answers as engine_submit_answers,
)

router = APIRouter(prefix="/api/english", tags=["english-gate"])

_locks: WeakValueDictionary[str, asyncio.Lock] = WeakValueDictionary()


async def session_guard(request: Request, applicant_id: str = Depends(require_applicant)):
    verify_seb(request)
    lock = _locks.setdefault(applicant_id, asyncio.Lock())
    async with lock:
        yield


async def _resolve_applicant(db: AsyncSession, applicant_id: str) -> Optional[Applicant]:
    applicant = await db.get(Applicant, applicant_id)
    if applicant is not None:
        return applicant
    applicant = (
        await db.execute(select(Applicant).where(Applicant.external_id == applicant_id))
    ).scalars().first()
    if applicant is not None:
        return applicant
    from app.infrastructure.models import UserTable
    user = await db.get(UserTable, applicant_id)
    if user:
        applicant = Applicant(
            external_id=user.id,
            full_name=user.name,
            email=user.email,
            state=ApplicantState.NEEDS_TEST,
        )
        db.add(applicant)
        await db.commit()
        await db.refresh(applicant)
        return applicant
    return None


async def _own_session(db: AsyncSession, session_id: str, applicant_id: str) -> TestSession:
    ts = await db.get(TestSession, session_id)
    if ts is None:
        raise not_found("session")
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None or ts.applicant_id != applicant.id:
        raise not_found("session")
    return ts


def _val(x):
    if x is None:
        return None
    return x.value if hasattr(x, "value") else str(x)


# ── Health & Demo ─────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"ok": True, "service": "english-gate"}


@router.post("/demo-start")
async def demo_start(db: AsyncSession = Depends(get_db)):
    """One-click demo applicant provisioning so /english/test starts instantly."""
    external_id = f"demo-{uuid.uuid4().hex[:8]}"
    applicant = Applicant(
        external_id=external_id,
        full_name="Demo Applicant",
        email=f"{external_id}@invision.demo",
        state=ApplicantState.NEEDS_TEST,
    )
    db.add(applicant)
    await db.commit()
    await db.refresh(applicant)

    token = create_applicant_token(applicant.id)
    return {
        "id": applicant.id,
        "external_id": applicant.external_id,
        "token": token,
        "state": applicant.state.value if hasattr(applicant.state, "value") else str(applicant.state),
    }


# ── Applicants ────────────────────────────────────────────────────────────────

@router.post("/applicants", response_model=ApplicantOut, dependencies=[Depends(require_platform_key)])
async def create_applicant(
    body: ApplicantCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = (
        await db.execute(select(Applicant).where(Applicant.external_id == body.external_id))
    ).scalars().first()
    if existing:
        applicant = existing
    else:
        applicant = Applicant(external_id=body.external_id, full_name=body.full_name, email=body.email)
        db.add(applicant)
        await db.commit()
        await db.refresh(applicant)

    token = create_applicant_token(applicant.id)
    return ApplicantOut(
        id=applicant.id,
        external_id=applicant.external_id,
        state=_val(applicant.state),
        placement=_val(applicant.placement),
        token=token,
    )


@router.get("/me", response_model=MeOut)
async def me(applicant_id: str = Depends(require_applicant), db: AsyncSession = Depends(get_db)):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")
    return MeOut(
        id=applicant.id,
        external_id=applicant.external_id,
        state=_val(applicant.state),
        placement=_val(applicant.placement),
        placement_source=_val(applicant.placement_source),
    )


# ── IELTS Check ───────────────────────────────────────────────────────────────

@router.post("/ielts", response_model=IeltsCheckOut)
async def submit_ielts(
    body: IeltsCheckIn,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
    verifier=Depends(get_verifier),
    webhook=Depends(get_webhook),
):
    applicant = await db.get(Applicant, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    check = await run_ielts_check(
        session=db,
        applicant=applicant,
        verifier=verifier,
        webhook=webhook,
        trf_number=body.trf_number,
        family_name=body.family_name,
        date_of_birth=body.date_of_birth,
        test_date=body.test_date,
        module=body.module.value if hasattr(body.module, "value") else str(body.module),
        listening=body.listening,
        reading=body.reading,
        writing=body.writing,
        speaking=body.speaking,
        overall=body.overall,
    )
    return IeltsCheckOut(
        id=check.id,
        verdict=check.verdict.value if hasattr(check.verdict, "value") else str(check.verdict),
        reason=check.reason,
        overall=check.overall,
    )


# ── Certificate Exemption & Upload ──────────────────────────────────────────

@router.post("/certificate")
async def submit_certificate(
    cert_type: str = Form(...),
    score: str = Form(...),
    test_date: Optional[str] = Form(None),
    cert_number: Optional[str] = Form(None),
    pdf: Optional[UploadFile] = File(None),
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
    storage=Depends(get_storage_dep),
):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    pdf_path = None
    if pdf is not None:
        data = await pdf.read(15 * 1024 * 1024 + 1)
        if len(data) > 15 * 1024 * 1024:
            raise HTTPException(413, "pdf_too_large")
        ext = (pdf.filename or "certificate.pdf").split(".")[-1].lower()
        if ext != "pdf":
            ext = "pdf"
        pdf_path = f"certificates/{applicant.id}/{uuid.uuid4().hex}.{ext}"
        await storage.save(pdf_path, data)

    try:
        numeric_score = float(score.strip())
    except ValueError:
        numeric_score = 6.5

    cert_upper = cert_type.upper()
    is_bachelor = False
    if "IELTS" in cert_upper and numeric_score >= 6.0:
        is_bachelor = True
    elif "TOEFL" in cert_upper and numeric_score >= 80:
        is_bachelor = True
    elif "DUOLINGO" in cert_upper and numeric_score >= 105:
        is_bachelor = True
    elif "CAMBRIDGE" in cert_upper and numeric_score >= 169:
        is_bachelor = True
    elif numeric_score >= 6.0:
        is_bachelor = True

    placement_verdict = "BACHELOR" if is_bachelor else "FOUNDATION"
    applicant.placement = Placement(placement_verdict)
    applicant.placement_source = f"certificate_{cert_type.lower()}"
    applicant.state = ApplicantState.PLACED
    db.add(applicant)

    from datetime import date
    parsed_date = date.today()
    if test_date:
        try:
            parsed_date = date.fromisoformat(test_date)
        except Exception:
            pass

    check = IeltsCheck(
        applicant_id=applicant.id,
        trf_number=cert_number or f"{cert_type.upper()}-{uuid.uuid4().hex[:6]}",
        family_name=applicant.full_name,
        date_of_birth=parsed_date,
        test_date=parsed_date,
        module=cert_type,
        listening=numeric_score,
        reading=numeric_score,
        writing=numeric_score,
        speaking=numeric_score,
        overall=numeric_score,
        verdict="VERIFIED",
        reason=f"{cert_type} Certificate Uploaded (Score: {score})",
        verifier_record={
            "cert_type": cert_type,
            "score": score,
            "cert_number": cert_number,
            "pdf_path": pdf_path,
        },
    )
    db.add(check)

    sessions = (
        await db.execute(
            select(TestSession)
            .where(TestSession.applicant_id == applicant.id)
            .order_by(TestSession.created_at.desc())
        )
    ).scalars().all()
    if sessions:
        ts = sessions[0]
        ts.state = SessionState.DECIDED
        ts.placement = applicant.placement
        db.add(ts)

    await db.commit()
    await db.refresh(applicant)

    return {
        "ok": True,
        "state": applicant.state.value if hasattr(applicant.state, "value") else str(applicant.state),
        "placement": applicant.placement.value if hasattr(applicant.placement, "value") else str(applicant.placement),
        "pdf_path": pdf_path,
        "cert_type": cert_type,
        "score": score,
    }


@router.get("/certificate/{applicant_id}/file")
async def get_certificate_file(
    applicant_id: str,
    db: AsyncSession = Depends(get_db),
    storage=Depends(get_storage_dep),
):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    checks = (
        await db.execute(
            select(IeltsCheck)
            .where(IeltsCheck.applicant_id == applicant.id)
            .order_by(IeltsCheck.checked_at.desc())
        )
    ).scalars().all()
    if not checks:
        raise not_found("certificate")

    pdf_path = (checks[0].verifier_record or {}).get("pdf_path")
    if not pdf_path:
        raise not_found("certificate_file")

    try:
        path = storage.local_path(pdf_path)
    except ValueError:
        raise not_found("certificate_file")
    if not Path(path).is_file():
        raise not_found("certificate_file")

    return FileResponse(path, media_type="application/pdf", filename=f"certificate_{applicant.id}.pdf")


@router.post("/skip")
async def skip_english_test(
    reason: str = Form("native_or_postponed"),
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    applicant.placement = Placement.BACHELOR
    applicant.placement_source = f"waived_{reason}"
    applicant.state = ApplicantState.NEEDS_REVIEW
    db.add(applicant)
    await db.commit()
    return {
        "ok": True,
        "state": applicant.state.value if hasattr(applicant.state, "value") else str(applicant.state),
        "placement": applicant.placement.value if hasattr(applicant.placement, "value") else str(applicant.placement),
    }


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.post("/sessions", dependencies=[Depends(session_guard)])
async def create_session(applicant_id: str = Depends(require_applicant), db: AsyncSession = Depends(get_db)):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    applicant_id = applicant.id

    if applicant.state == ApplicantState.PLACED:
        raise conflict("applicant_already_placed")

    existing = (
        await db.execute(select(TestSession).where(TestSession.applicant_id == applicant_id))
    ).scalars().all()
    retakes = (
        await db.execute(
            select(Review).where(
                Review.session_id.in_([x.id for x in existing]), Review.decision == "retake"
            )
        )
    ).scalars().all() if existing else []
    if len(existing) >= english_settings.max_attempts + len({r.session_id for r in retakes}):
        raise conflict("attempt_already_used")

    ts = TestSession(applicant_id=applicant_id)
    db.add(ts)
    await db.flush()
    await build_form(db, ts)

    applicant.state = ApplicantState.TESTING
    db.add(applicant)
    session_id = ts.id
    session_state = ts.state.value if hasattr(ts.state, "value") else str(ts.state)
    await db.commit()

    return {"session_id": session_id, "state": session_state}


@router.get("/sessions/current", dependencies=[Depends(session_guard)])
async def current_session(applicant_id: str = Depends(require_applicant), db: AsyncSession = Depends(get_db)):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")
    sessions = (
        await db.execute(
            select(TestSession)
            .where(TestSession.applicant_id == applicant.id)
            .order_by(TestSession.created_at.desc())
        )
    ).scalars().all()
    if not sessions:
        return None
    if applicant.state == ApplicantState.NEEDS_TEST:
        return None
    ts = sessions[0]
    session_id = ts.id
    session_state = ts.state.value if hasattr(ts.state, "value") else str(ts.state)
    return {"session_id": session_id, "state": session_state}


@router.post("/sessions/{session_id}/checkin", dependencies=[Depends(session_guard)])
async def checkin(
    session_id: str,
    body: CheckinIn,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)

    existing = (
        await db.execute(select(Checkin).where(Checkin.session_id == session_id))
    ).scalars().first()
    if existing:
        existing.gates = body.gates
        if body.consent:
            existing.consent_at = datetime.utcnow()
        db.add(existing)
    else:
        db.add(
            Checkin(
                session_id=session_id,
                gates=body.gates,
                consent_at=datetime.utcnow() if body.consent else None,
            )
        )
    await db.flush()

    if not body.consent:
        await db.commit()
        return {"passed": False, "missing": ["consent"]}
    if not gates_passed(body.gates):
        await db.commit()
        return {"passed": False, "missing": missing_gates(body.gates)}

    if ts.state in (SessionState.GRADING, SessionState.DECIDED, SessionState.NEEDS_REVIEW):
        raise conflict("session_already_finished")
    if ts.current_section is not None:
        items, stage = await get_current_items(db, ts)
        await db.commit()
        return {
            "passed": True,
            "section": ts.current_section,
            "stage": stage.value,
            "items": client_view(items),
            "deadline": ts.section_deadline[ts.current_section],
        }

    ts.state = SessionState.CHECKIN
    db.add(ts)
    await db.flush()
    section = await start_next_section(db, ts)
    items, stage = await get_current_items(db, ts)
    return {
        "passed": True,
        "section": section.value,
        "stage": stage.value,
        "items": client_view(items),
        "deadline": ts.section_deadline[section.value],
    }


@router.get("/sessions/{session_id}/section", dependencies=[Depends(session_guard)])
async def get_section(
    session_id: str,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)
    if ts.current_section is None:
        raise conflict("section_not_started")
    items, stage = await get_current_items(db, ts)
    return {
        "section": ts.current_section,
        "stage": stage.value,
        "items": client_view(items),
        "deadline": ts.section_deadline.get(ts.current_section),
        "screen_token_seed": ts.screen_token_seed,
    }


@router.post("/sessions/{session_id}/answers", dependencies=[Depends(session_guard)])
async def submit_answers(
    session_id: str,
    body: AnswersIn,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)
    if ts.current_section not in (Section.LISTENING.value, Section.READING.value, Section.WRITING.value):
        raise conflict("wrong_section_for_answers")
    return await engine_submit_answers(db, ts, [a.model_dump() for a in body.answers])


@router.post("/sessions/{session_id}/media", dependencies=[Depends(session_guard)])
async def upload_media(
    session_id: str,
    kind: str = Form(default="speaking"),
    item_id: Optional[str] = Form(default=None),
    audio: Optional[UploadFile] = File(default=None),
    file: Optional[UploadFile] = File(default=None),
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
    storage=Depends(get_storage_dep),
    asr=Depends(get_asr),
    llm=Depends(get_llm),
):
    upload = audio or file
    if upload is None:
        raise HTTPException(status_code=422, detail="missing_media_file")

    ts = await _own_session(db, session_id, applicant_id)
    if kind not in {"speaking", "proctor"}:
        raise HTTPException(422, "unsupported_media_kind")
    if ts.state in (SessionState.GRADING, SessionState.DECIDED, SessionState.NEEDS_REVIEW):
        raise conflict("session_already_finished")
    if kind == "speaking":
        if ts.current_section != Section.SPEAKING.value:
            raise conflict("wrong_section_for_media")
        if is_past_deadline(ts, Section.SPEAKING):
            return await expire_section(db, ts)
        if item_id and item_id not in ts.form.get("speaking", {}).get("items", []):
            raise conflict("item_not_in_current_stage")

    data = await upload.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "media_too_large")
    if not data:
        raise HTTPException(422, "empty_media")

    ext = (upload.filename or "").split(".")[-1].lower()
    allowed = {"webm", "wav", "mp4", "ogg"} if kind == "speaking" else {"jpg", "jpeg"}
    if ext not in allowed:
        ext = "webm" if kind == "speaking" else "jpg"

    path = f"sessions/{session_id}/{kind}/{item_id or uuid.uuid4().hex}.{ext}"
    await storage.save(path, data)

    if kind == "speaking":
        item = await db.get(Item, item_id) if item_id else None
        if item is None:
            raise not_found("item")

        existing = (
            await db.execute(
                select(Response).where(Response.session_id == session_id, Response.item_id == item_id)
            )
        ).scalars().first()
        if existing:
            existing.media_path = path
            db.add(existing)
        else:
            db.add(
                Response(
                    session_id=session_id,
                    item_id=item_id,
                    section=Section.SPEAKING,
                    stage=Stage.SINGLE,
                    media_path=path,
                )
            )
        await db.commit()

        required_ids = set(ts.form.get("speaking", {}).get("items", []))
        answered = set(
            (
                await db.execute(
                    select(Response.item_id).where(
                        Response.session_id == session_id, Response.section == Section.SPEAKING
                    )
                )
            ).scalars()
        )
        if required_ids.issubset(answered):
            next_section = await start_next_section(db, ts)
            if next_section is None:
                return {"section_complete": True, "next_section": None, "state": "grading"}
            items, stage = await get_current_items(db, ts)
            return {
                "section_complete": True,
                "next_section": next_section.value,
                "stage": stage.value,
                "items": client_view(items),
            }
        return {"section_complete": False}

    return {"stored": True, "path": path}


@router.get("/sessions/{session_id}/followup", dependencies=[Depends(session_guard)])
async def get_followup(
    session_id: str,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)
    fu_id = f"S-FU-GEN-{session_id}"
    item = await db.get(Item, fu_id)
    if item is None:
        raise HTTPException(status_code=202, detail="not_ready")
    return {"id": item.id, **item.content}


@router.post("/sessions/{session_id}/events", dependencies=[Depends(session_guard)])
async def post_events(
    session_id: str,
    body: EventsIn,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)

    last = (
        await db.execute(
            select(ProctorEvent.seq)
            .where(ProctorEvent.session_id == session_id)
            .order_by(ProctorEvent.seq.desc())
            .limit(1)
        )
    ).scalars().first()

    for e in sorted(body.events, key=lambda event: event.seq):
        if last is not None and e.seq <= last:
            continue
        if last is not None and e.seq > last + 1:
            db.add(
                ProctorEvent(
                    session_id=session_id,
                    seq=e.seq - 1,
                    type="seq_gap",
                    ts_client=e.ts_client,
                    data={"expected": last + 1, "got": e.seq},
                )
            )
        db.add(
            ProctorEvent(
                session_id=session_id,
                seq=e.seq,
                type=e.type,
                section=Section(e.section) if e.section else None,
                ts_client=e.ts_client,
                data=e.data,
            )
        )
        last = e.seq
    await db.commit()
    return {"received": len(body.events), "last_seq": last or 0}


@router.post("/sessions/{session_id}/finish", dependencies=[Depends(session_guard)])
async def finish_session(
    session_id: str,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
    llm=Depends(get_llm),
    asr=Depends(get_asr),
    languagetool=Depends(get_languagetool),
    webhook=Depends(get_webhook),
    storage=Depends(get_storage_dep),
):
    ts = await _own_session(db, session_id, applicant_id)
    if ts.state in (SessionState.DECIDED, SessionState.NEEDS_REVIEW):
        return {"state": ts.state.value if hasattr(ts.state, "value") else str(ts.state), "placement": ts.placement}
    if ts.state != SessionState.GRADING:
        raise conflict("test_not_complete")

    ts = await grade_session(
        db, ts, llm=llm, asr=asr, languagetool=languagetool, webhook=webhook, storage=storage
    )
    return {"state": ts.state.value if hasattr(ts.state, "value") else str(ts.state), "placement": ts.placement}


@router.post("/sessions/{session_id}/expire", dependencies=[Depends(session_guard)])
async def expire(
    session_id: str,
    body: dict,
    applicant_id: str = Depends(require_applicant),
    db: AsyncSession = Depends(get_db),
):
    ts = await _own_session(db, session_id, applicant_id)
    if ts.state in (SessionState.GRADING, "grading"):
        return {"section_complete": True, "next_section": None, "state": "grading"}
    if body.get("section") != ts.current_section:
        raise conflict("section_changed")
    if ts.current_section is None or not is_past_deadline(ts, Section(ts.current_section)):
        raise conflict("section_not_expired")
    return await expire_section(db, ts)


# ── Admin Routes ──────────────────────────────────────────────────────────────

@router.post("/admin/login", response_model=AdminLoginOut)
async def admin_login(body: AdminLoginIn):
    if body.email != english_settings.admin_email or body.password != english_settings.admin_password:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    return AdminLoginOut(token=create_admin_token(body.email))


@router.get("/admin/queue")
async def queue(admin: str = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    sessions = (
        await db.execute(select(TestSession).where(TestSession.state == SessionState.NEEDS_REVIEW))
    ).scalars().all()

    pending_cutoff = datetime.utcnow() - timedelta(hours=24)
    pending_checks = (
        await db.execute(
            select(IeltsCheck).where(IeltsCheck.verdict == IeltsVerdict.PENDING, IeltsCheck.checked_at < pending_cutoff)
        )
    ).scalars().all()

    return {
        "sessions": [
            {
                "id": s.id,
                "applicant_id": s.applicant_id,
                "levels": s.levels,
                "placement": s.placement,
                "integrity_level": s.integrity_level,
                "flags": s.flags,
            }
            for s in sessions
        ],
        "ielts_checks": [
            {"id": c.id, "applicant_id": c.applicant_id, "trf_number": c.trf_number, "checked_at": c.checked_at}
            for c in pending_checks
        ],
    }


@router.get("/admin/dashboard")
async def dashboard(admin: str = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    applicants = list((await db.execute(select(Applicant).order_by(Applicant.created_at.desc()))).scalars())
    sessions = list((await db.execute(select(TestSession).order_by(TestSession.created_at.desc()))).scalars())
    checks = list((await db.execute(select(IeltsCheck).order_by(IeltsCheck.checked_at.desc()))).scalars())
    latest = {}
    for session in sessions:
        latest.setdefault(session.applicant_id, session)
    certificates = {}
    for check in checks:
        certificates.setdefault(check.applicant_id, check)
    rows = []
    for a in applicants:
        s = latest.get(a.id)
        c = certificates.get(a.id)
        rows.append({
            "id": a.id,
            "full_name": a.full_name,
            "email": a.email,
            "state": a.state.value if hasattr(a.state, "value") else str(a.state),
            "session_id": s.id if s else None,
            "created_at": a.created_at,
            "levels": s.levels if s else {},
            "flags": s.flags if s else {},
            "placement": a.placement,
            "recommendation": s.placement if s else None,
            "source": a.placement_source,
            "integrity": s.integrity_level if s else None,
            "ielts": {"verdict": c.verdict, "overall": c.overall, "reason": c.reason} if c else None,
        })
    return {
        "applicants": rows,
        "metrics": {
            "total": len(rows),
            "review": sum(a.state == ApplicantState.NEEDS_REVIEW for a in applicants),
            "placed": sum(a.state == ApplicantState.PLACED for a in applicants),
            "testing": sum(a.state == ApplicantState.TESTING for a in applicants),
            "ielts_fast_track": sum(a.placement_source == PlacementSource.IELTS for a in applicants),
        },
        "services": {
            "ielts": english_settings.ielts_verifier,
            "asr": english_settings.asr_backend,
            "llm_configured": bool(english_settings.gemini_model),
            "auto_placement": english_settings.auto_placement_enabled,
            "lockdown_required": english_settings.require_seb,
        },
    }


@router.get("/admin/applicants/{applicant_id}")
async def applicant_detail(
    applicant_id: str,
    admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    applicant = await _resolve_applicant(db, applicant_id)
    if applicant is None:
        raise not_found("applicant")

    sessions = (
        await db.execute(
            select(TestSession)
            .where(TestSession.applicant_id == applicant.id)
            .order_by(TestSession.created_at.desc())
        )
    ).scalars().all()
    ts = sessions[0] if sessions else None

    checks = (
        await db.execute(
            select(IeltsCheck)
            .where(IeltsCheck.applicant_id == applicant.id)
            .order_by(IeltsCheck.checked_at.desc())
        )
    ).scalars().all()
    ielts = checks[0] if checks else None

    responses = []
    events = []
    reviews = []
    if ts:
        responses = (
            await db.execute(select(Response).where(Response.session_id == ts.id))
        ).scalars().all()
        events = (
            await db.execute(select(ProctorEvent).where(ProctorEvent.session_id == ts.id).order_by(ProctorEvent.seq))
        ).scalars().all()
        reviews = (
            await db.execute(select(Review).where(Review.session_id == ts.id).order_by(Review.created_at.desc()))
        ).scalars().all()

    items = {}
    if responses:
        items = {
            i.id: i
            for i in (
                await db.execute(select(Item).where(Item.id.in_([r.item_id for r in responses])))
            ).scalars()
        }

    return {
        "id": applicant.id,
        "full_name": applicant.full_name,
        "email": applicant.email,
        "state": applicant.state.value if hasattr(applicant.state, "value") else str(applicant.state),
        "placement": applicant.placement,
        "placement_source": applicant.placement_source,
        "ielts": {
            "trf_number": ielts.trf_number,
            "overall": ielts.overall,
            "verdict": ielts.verdict,
            "module": ielts.module,
            "listening": ielts.listening,
            "reading": ielts.reading,
            "writing": ielts.writing,
            "speaking": ielts.speaking,
        } if ielts else None,
        "session": {
            "id": ts.id,
            "levels": ts.levels,
            "flags": ts.flags,
            "placement": ts.placement,
            "integrity_score": ts.integrity_score,
            "integrity_level": ts.integrity_level,
        } if ts else None,
        "responses": [
            {
                "id": r.id,
                "prompt": items[r.item_id].content.get("prompt", items[r.item_id].content.get("text", "")) if r.item_id in items else "",
                "item_id": r.item_id,
                "section": r.section,
                "answer": r.answer,
                "media_path": r.media_path,
                "correct": r.correct,
                "grade": r.grade,
            }
            for r in responses
        ],
        "events": [
            {"seq": e.seq, "type": e.type, "section": e.section, "ts_server": e.ts_server, "data": e.data}
            for e in events
        ],
        "reviews": [
            {"decision": r.decision, "note": r.note, "reviewer": r.reviewer, "created_at": r.created_at}
            for r in reviews
        ],
    }


@router.post("/auth-link", response_model=ApplicantOut)
async def auth_link_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Links or retrieves an English Gate applicant profile for the currently logged-in platform user."""
    from app.core.auth import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    token = auth.split(" ", 1)[1]
    from app.core.security import decode_access_token
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="invalid_token")
    user_id = payload["sub"]
    from app.infrastructure.models import UserTable
    user = await db.get(UserTable, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    applicant = (
        await db.execute(select(Applicant).where(Applicant.external_id == user.id))
    ).scalars().first()
    if applicant is None:
        applicant = Applicant(
            external_id=user.id,
            full_name=user.name,
            email=user.email,
            state=ApplicantState.NEEDS_TEST,
        )
        db.add(applicant)
        await db.commit()
        await db.refresh(applicant)

    return ApplicantOut(
        id=applicant.id,
        token=create_applicant_token(applicant.id),
        state=applicant.state.value if hasattr(applicant.state, "value") else str(applicant.state),
        placement=applicant.placement,
        placement_source=applicant.placement_source,
    )


@router.get("/admin/sessions/{session_id}")
async def session_detail(
    session_id: str,
    admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ts = await db.get(TestSession, session_id)
    if ts is None:
        raise not_found("session")

    responses = (
        await db.execute(select(Response).where(Response.session_id == session_id))
    ).scalars().all()
    events = (
        await db.execute(select(ProctorEvent).where(ProctorEvent.session_id == session_id).order_by(ProctorEvent.seq))
    ).scalars().all()

    applicant = await db.get(Applicant, ts.applicant_id)
    items = {
        i.id: i
        for i in (
            await db.execute(select(Item).where(Item.id.in_([r.item_id for r in responses])))
        ).scalars()
    } if responses else {}
    reviews = (
        await db.execute(select(Review).where(Review.session_id == ts.id).order_by(Review.created_at.desc()))
    ).scalars().all()
    return {
        "full_name": applicant.full_name if applicant else "Unknown",
        "email": applicant.email if applicant else "",
        "state": ts.state.value if hasattr(ts.state, "value") else str(ts.state),
        "reviews": [
            {"decision": r.decision, "note": r.note, "reviewer": r.reviewer, "created_at": r.created_at}
            for r in reviews
        ],
        "id": ts.id,
        "applicant_id": ts.applicant_id,
        "levels": ts.levels,
        "flags": ts.flags,
        "placement": ts.placement,
        "integrity_score": ts.integrity_score,
        "integrity_level": ts.integrity_level,
        "responses": [
            {
                "id": r.id,
                "prompt": items[r.item_id].content.get("prompt", items[r.item_id].content.get("text", "")) if r.item_id in items else "",
                "item_id": r.item_id,
                "section": r.section,
                "answer": r.answer,
                "media_path": r.media_path,
                "correct": r.correct,
                "grade": r.grade,
            }
            for r in responses
        ],
        "events": [
            {"seq": e.seq, "type": e.type, "section": e.section, "ts_server": e.ts_server, "data": e.data}
            for e in events
        ],
    }


@router.post("/admin/reviews")
async def create_review(
    body: ReviewIn,
    admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if bool(body.session_id) == bool(body.ielts_check_id):
        raise HTTPException(422, "exactly_one_review_target_required")
    if not body.note or not body.note.strip():
        raise HTTPException(422, "review_note_required")
    if body.session_id:
        ts = await db.get(TestSession, body.session_id)
        if ts is None:
            raise not_found("session")
        if ts.state not in (SessionState.NEEDS_REVIEW, SessionState.DECIDED, "needs_review", "decided"):
            raise HTTPException(409, "assessment_not_complete")
        applicant = await db.get(Applicant, ts.applicant_id)
        review = Review(session_id=ts.id, reviewer=admin, decision=body.decision, note=body.note)
        db.add(review)

        if body.decision == "retake":
            applicant.state = ApplicantState.NEEDS_TEST
            applicant.placement = None
            applicant.placement_source = None
            ts.state = SessionState.DECIDED
        else:
            applicant.placement = Placement(body.decision)
            applicant.placement_source = PlacementSource.HUMAN
            applicant.state = ApplicantState.PLACED
            ts.state = SessionState.DECIDED
            ts.placement = Placement(body.decision)
        db.add(ts)
        db.add(applicant)
        await db.commit()
        return {"ok": True}

    if body.ielts_check_id:
        if body.decision == "retake":
            raise HTTPException(422, "retake_requires_session")
        check = await db.get(IeltsCheck, body.ielts_check_id)
        if check is None:
            raise not_found("ielts_check")
        applicant = await db.get(Applicant, check.applicant_id)
        review = Review(ielts_check_id=check.id, reviewer=admin, decision=body.decision, note=body.note)
        db.add(review)
        applicant.placement = Placement(body.decision)
        applicant.placement_source = PlacementSource.HUMAN
        applicant.state = ApplicantState.PLACED
        db.add(applicant)
        await db.commit()
        return {"ok": True}

    raise HTTPException(status_code=400, detail="session_id_or_ielts_check_id_required")


@router.post("/admin/sessions/{session_id}/decision")
async def submit_decision(
    session_id: str,
    decision_data: dict,
    admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ts = await db.get(TestSession, session_id)
    if ts is None:
        applicant = await _resolve_applicant(db, session_id)
        if applicant:
            sessions = (
                await db.execute(
                    select(TestSession)
                    .where(TestSession.applicant_id == applicant.id)
                    .order_by(TestSession.created_at.desc())
                )
            ).scalars().all()
            if sessions:
                ts = sessions[0]
            else:
                ts = TestSession(applicant_id=applicant.id, state=SessionState.DECIDED)
                db.add(ts)
                await db.flush()
    if ts is None:
        raise not_found("session")
    applicant = await db.get(Applicant, ts.applicant_id)
    if applicant is None:
        raise not_found("applicant")

    placement = decision_data.get("placement", "BACHELOR")
    notes = decision_data.get("notes", "")

    review = Review(
        session_id=ts.id,
        reviewer=admin,
        decision=ReviewDecision(placement) if placement in ("BACHELOR", "FOUNDATION") else ReviewDecision.BACHELOR,
        note=notes,
    )
    db.add(review)

    applicant.placement = Placement(placement) if placement in ("BACHELOR", "FOUNDATION") else Placement.BACHELOR
    applicant.placement_source = PlacementSource.HUMAN
    applicant.state = ApplicantState.PLACED
    ts.state = SessionState.DECIDED
    ts.placement = applicant.placement

    db.add(ts)
    db.add(applicant)
    await db.commit()
    return {"ok": True}


@router.get("/admin/responses/{response_id}/audio")
async def response_audio(
    response_id: str,
    admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    storage=Depends(get_storage_dep),
):
    response = await db.get(Response, response_id)
    if response is None or not response.media_path:
        raise not_found("recording")
    try:
        path = storage.local_path(response.media_path)
    except ValueError:
        raise not_found("recording")
    if not Path(path).is_file():
        raise not_found("recording")
    return FileResponse(path, headers={"Cache-Control": "no-store"})


# ── Media Serving ─────────────────────────────────────────────────────────────

@router.get("/media/{file_path:path}")
async def get_media(file_path: str, storage=Depends(get_storage_dep)):
    if file_path.startswith("sessions/") or ".." in file_path:
        raise not_found("media_file")
    try:
        path = storage.local_path(file_path)
    except ValueError:
        raise not_found("media_file")
    if not Path(path).is_file():
        raise not_found("media_file")
    return FileResponse(path)
