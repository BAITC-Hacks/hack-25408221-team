import hashlib
from datetime import datetime, timedelta, timezone
import pytest
from sqlmodel import select
from app.english.config import english_settings as settings
from app.english.core.security import create_applicant_token
from app.english.domain.enums import SessionState
from app.english.infra.models import Applicant, TestSession as Session, ProctorEvent, Response
from app.english.infra.storage import LocalStorage

async def setup_session(client, platform_headers, loaded_items):
    a=(await client.post('/applicants',headers=platform_headers,json={'external_id':'security-test','full_name':'Security Test','email':'test@example.com'})).json()
    h={'Authorization':f"Bearer {a['token']}"}
    s=(await client.post('/sessions',headers=h)).json()
    return a,h,s['session_id']

async def test_cannot_finish_early(client,platform_headers,loaded_items):
    _,h,sid=await setup_session(client,platform_headers,loaded_items)
    r=await client.post(f'/sessions/{sid}/finish',headers=h)
    assert r.status_code==409
    assert r.json()['detail']=='test_not_complete'

async def test_event_retries_idempotent(client,platform_headers,loaded_items,db_session):
    _,h,sid=await setup_session(client,platform_headers,loaded_items)
    payload={'events':[{'seq':1,'type':'heartbeat'},{'seq':2,'type':'window_blur'}]}
    for _ in range(2): assert (await client.post(f'/sessions/{sid}/events',headers=h,json=payload)).status_code==200
    events=list((await db_session.execute(select(ProctorEvent).where(ProctorEvent.session_id==sid))).scalars())
    assert len(events)==2

async def test_session_ownership(client,platform_headers,loaded_items):
    _,_,sid=await setup_session(client,platform_headers,loaded_items)
    h={'Authorization':f'Bearer {create_applicant_token("someone-else")}' }
    assert (await client.get(f'/sessions/{sid}/section',headers=h)).status_code==404

async def test_protected_recordings(client,admin_token,db_session,tmp_path):
    a=Applicant(external_id='audio',full_name='Audio',email='a@example.com');db_session.add(a);await db_session.flush()
    s=Session(applicant_id=a.id);db_session.add(s);await db_session.flush()
    r=Response(session_id=s.id,item_id='S-test',section='speaking',stage='single',media_path='sessions/test/speaking/audio.wav');db_session.add(r);await db_session.commit()
    path=tmp_path/r.media_path;path.parent.mkdir(parents=True);path.write_bytes(b'RIFF-test-recording')
    assert (await client.get(f'/admin/responses/{r.id}/audio')).status_code in (401,403)
    assert (await client.get('/media/sessions/test/speaking/audio.wav')).status_code==404
    response=await client.get(f'/admin/responses/{r.id}/audio',headers={'Authorization':f'Bearer {admin_token}'})
    assert response.status_code==200 and response.content==b'RIFF-test-recording'
    assert response.headers['cache-control']=='no-store'

def test_path_traversal(tmp_path):
    with pytest.raises(ValueError):LocalStorage(str(tmp_path)).local_path('../secret.env')

async def test_retake_once(client,platform_headers,loaded_items,db_session,admin_token):
    _,h,sid=await setup_session(client,platform_headers,loaded_items)
    s=await db_session.get(Session,sid);s.state=SessionState.NEEDS_REVIEW;db_session.add(s);await db_session.commit()
    r=await client.post('/admin/reviews',headers={'Authorization':f'Bearer {admin_token}'},json={'session_id':sid,'decision':'retake','note':'Audio could not be assessed.'})
    assert r.status_code==200
    assert (await client.get('/sessions/current',headers=h)).json() is None
    assert (await client.post('/sessions',headers=h)).status_code==200
    assert (await client.post('/sessions',headers=h)).status_code==409

async def test_seb_requires_signed_request(client,platform_headers,loaded_items,monkeypatch):
    _,h,_=await setup_session(client,platform_headers,loaded_items)
    monkeypatch.setattr(settings,'require_seb',True);monkeypatch.setattr(settings,'seb_browser_exam_key','a'*64)
    assert (await client.get('/sessions/current',headers={**h,'User-Agent':'SEB/3.0'})).status_code==403
    signature=hashlib.sha256(('http://test/api/english/sessions/current'+'a'*64).encode()).hexdigest()
    assert (await client.get('/sessions/current',headers={**h,'X-SafeExamBrowser-RequestHash':signature})).status_code==200

async def test_stale_expiry(client,platform_headers,loaded_items,db_session):
    _,h,sid=await setup_session(client,platform_headers,loaded_items)
    s=await db_session.get(Session,sid);s.state=SessionState.READING;s.current_section='reading';s.section_deadline={'reading':(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat()};db_session.add(s);await db_session.commit()
    assert (await client.post(f'/sessions/{sid}/expire',headers=h,json={'section':'listening'})).status_code==409
    r=await client.post(f'/sessions/{sid}/expire',headers=h,json={'section':'reading'})
    assert r.status_code==200 and r.json()['next_section']=='writing'

async def test_dashboard_auth(client,admin_token):
    assert (await client.get('/admin/dashboard')).status_code in (401,403)
    r=await client.get('/admin/dashboard',headers={'Authorization':f'Bearer {admin_token}'})
    assert r.status_code==200 and r.json()['metrics']['total']==0

async def test_review_validation(client,admin_token):
    h={'Authorization':f'Bearer {admin_token}'}
    assert (await client.post('/admin/reviews',headers=h,json={'decision':'nonsense'})).status_code==422
    assert (await client.post('/admin/reviews',headers=h,json={'decision':'BACHELOR','session_id':'a','ielts_check_id':'b','note':'test'})).status_code==422

@pytest.mark.parametrize('raw',['[]','null','true','{"fluency":{"level":true,"evidence":"abc"}}','{"fluency":{"level":4,"evidence":123}}'])
def test_malformed_model_output(raw):
    from app.english.grading.llm_rubric import _parse_and_validate
    assert _parse_and_validate(raw,['fluency'],'abc') is None

async def test_full_http_flow_provider_failure_never_becomes_foundation(client, platform_headers, loaded_items, admin_token):
    a,h,sid=await setup_session(client,platform_headers,loaded_items)
    gates={k:True for k in ['browser_ok','camera_mic_ok','screen_share_monitor','not_extended','fullscreen','single_face_confirmed']}
    current=(await client.post(f'/sessions/{sid}/checkin',headers=h,json={'gates':gates,'consent':True})).json()
    assert current['passed']
    assert 'transcript' not in current['items'][0]
    for _ in range(4):
        items=current['items']
        r=await client.post(f'/sessions/{sid}/answers',headers=h,json={'answers':[{'item_id':i['id'],'answer':{}} for i in items]})
        assert r.status_code==200,r.text
        current=r.json()
    assert current['next_section']=='writing'
    r=await client.post(f'/sessions/{sid}/answers',headers=h,json={'answers':[{'item_id':current['items'][0]['id'],'answer':'I like studying with classmates because we help each other. '*10}]})
    current=r.json();assert current['next_section']=='speaking'
    for item in current['items']:
        r=await client.post(f'/sessions/{sid}/media',headers=h,data={'kind':'speaking','item_id':item['id']},files={'file':('answer.webm',b'test-audio','audio/webm')})
        assert r.status_code==200,r.text
    assert r.json()['state']=='grading'
    await client.post(f'/sessions/{sid}/events',headers=h,json={'events':[{'seq':1,'type':'heartbeat'}]})
    result=await client.post(f'/sessions/{sid}/finish',headers=h)
    assert result.status_code==200,result.text
    assert result.json()=={'state':'needs_review','placement':None}
    me=(await client.get('/me',headers=h)).json()
    assert me['placement'] is None and me['state']=='needs_review'
    again=await client.post(f'/sessions/{sid}/finish',headers=h)
    assert again.json()==result.json()
    detail=(await client.get(f'/admin/sessions/{sid}',headers={'Authorization':f'Bearer {admin_token}'})).json()
    assert detail['levels']['writing'] is None
    assert detail['levels']['speaking'] is None
    assert len(detail['responses'])==10
