"""Validate signed identity and application context independently of authorization."""
from dataclasses import dataclass
from fastapi import HTTPException
import jwt
from jwt.exceptions import PyJWTError
from app.core.config import settings


def invalid_session():
    return HTTPException(401, "Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})


@dataclass(frozen=True)
class SessionClaims:
    email: str
    version: int
    company_id: int | None
    membership_version: int
    application_kind: str | None = None
    grant_id: int | None = None
    grant_version: int | None = None


def session_claims(bearer_token: str | None, session_token: str | None) -> SessionClaims:
    token = bearer_token or session_token
    if not token:
        raise invalid_session()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email, version = payload.get("sub"), payload.get("ver")
        company, membership = payload.get("company_id"), payload.get("membership_version", 0)
        kind, grant, epoch = (payload.get(key) for key in
            ("application_kind", "application_grant_id", "application_grant_version"))
        if not isinstance(email, str) or not email.strip() or type(version) is not int or version < 0:
            raise invalid_session()
        if company is not None and (type(company) is not int or company < 1):
            raise invalid_session()
        if type(membership) is not int or membership < 0 or ("membership_version" in payload and company is None):
            raise invalid_session()
        if kind is None:
            if any(key in payload for key in ("application_kind", "application_grant_id", "application_grant_version")):
                raise invalid_session()
        elif type(kind) is not str:
            raise invalid_session()
        elif kind in {"internal", "worker"}:
            if (company is None or "membership_version" not in payload
                    or "application_grant_id" in payload or "application_grant_version" in payload):
                raise invalid_session()
        elif kind in {"client", "adviser"}:
            if "company_id" in payload or "membership_version" in payload:
                raise invalid_session()
            if type(grant) is not int or grant < 1 or type(epoch) is not int or epoch < 0:
                raise invalid_session()
        else:
            raise invalid_session()
    except PyJWTError as error:
        raise invalid_session() from error
    return SessionClaims(email, version, company, membership, kind, grant, epoch)
