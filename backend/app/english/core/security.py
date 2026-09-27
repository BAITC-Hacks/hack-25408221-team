from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException, Header, status
from jose import JWTError, jwt

from app.config import settings
from app.english.config import english_settings

Role = Literal["applicant", "admin"]


def create_token(subject: str, role: Role, expires: timedelta) -> str:
    payload = {
        "sub": subject,
        "role": role,
        "exp": datetime.now(timezone.utc) + expires,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_applicant_token(applicant_id: str) -> str:
    return create_token(
        applicant_id, "applicant", timedelta(days=english_settings.applicant_token_expiry_days)
    )


def create_admin_token(email: str) -> str:
    return create_token(
        email, "admin", timedelta(hours=english_settings.admin_token_expiry_hours)
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")
    return authorization.split(" ", 1)[1]


def require_applicant(authorization: str | None = Header(default=None)) -> str:
    """Returns the applicant id."""
    token = _bearer(authorization)
    payload = decode_token(token)
    if payload.get("role") != "applicant":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not_applicant")
    return payload["sub"]


def require_admin(authorization: str | None = Header(default=None)) -> str:
    """Returns the admin email."""
    token = _bearer(authorization)
    payload = decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not_admin")
    return payload["sub"]


def require_platform_key(x_api_key: str | None = Header(default=None)) -> None:
    if x_api_key != english_settings.platform_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_api_key")
