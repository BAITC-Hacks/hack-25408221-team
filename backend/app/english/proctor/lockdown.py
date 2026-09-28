import hashlib
import hmac
from fastapi import HTTPException, Request
from app.english.config import english_settings


def verify_seb(request: Request) -> None:
    if not english_settings.require_seb:
        return
    key = english_settings.seb_browser_exam_key.strip().lower()
    if len(key) != 64 or any(c not in "0123456789abcdef" for c in key):
        raise HTTPException(503, "lockdown_not_configured")
    url = str(request.url).split("#", 1)[0]
    if english_settings.public_api_url:
        url = english_settings.public_api_url.rstrip("/") + request.url.path
        if request.url.query:
            url += "?" + request.url.query
    expected = hashlib.sha256((url + key).encode("utf-8")).hexdigest()
    supplied = request.headers.get("X-SafeExamBrowser-RequestHash", "")
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(403, "approved_safe_exam_browser_required")
