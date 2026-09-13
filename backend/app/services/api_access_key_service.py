"""Business rules for issuing and authenticating public API keys."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.api_access_key import ApiAccessKey
from app.models.user import User
from app.repositories import audit_log as audit_log_repo
from app.repositories import api_access_key as api_key_repo
from app.schemas.api_access_key import ApiAccessKeyCreate
from app.services.entitlement_service import require_company_feature
from app.services.subscription_policy import require_company_access
from app.services.user_scope import require_company_context


API_FEATURE_CODE = "features.api"
WORK_ORDERS_READ_SCOPE = "work_orders.read"
RESERVATIONS_WRITE_SCOPE = "reservations.write"
KNOWN_SCOPES = {WORK_ORDERS_READ_SCOPE, RESERVATIONS_WRITE_SCOPE}


@dataclass(frozen=True)
class ApiAccessPrincipal:
    key: ApiAccessKey
    company_id: int
    scope: str


@dataclass(frozen=True)
class CreatedApiAccessKey:
    key: ApiAccessKey
    secret: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_api_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _require_company_api_access(db: Session, current_user: User) -> int:
    company_id = require_company_context(current_user)
    if current_user.company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    require_company_access(current_user.company)
    require_company_feature(db, company_id=company_id, code=API_FEATURE_CODE)
    return company_id


def _issue_secret() -> tuple[str, str]:
    # The prefix lets an administrator identify a credential without retaining
    # the credential itself. The full, high-entropy key is returned once only.
    prefix = f"whk_{secrets.token_urlsafe(7)}"
    secret = f"{prefix}_{secrets.token_urlsafe(32)}"
    return prefix, secret


def list_keys(db: Session, *, current_user: User) -> list[ApiAccessKey]:
    company_id = _require_company_api_access(db, current_user)
    return api_key_repo.list_for_company(db, company_id=company_id)


def create_key(
    db: Session,
    *,
    current_user: User,
    payload: ApiAccessKeyCreate,
) -> CreatedApiAccessKey:
    company_id = _require_company_api_access(db, current_user)
    if payload.expires_at is not None and payload.expires_at <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="API key expiration must be in the future",
        )

    for _ in range(3):
        prefix, secret = _issue_secret()
        key = ApiAccessKey(
            company_id=company_id,
            created_by_user_id=current_user.id,
            name=payload.name,
            key_prefix=prefix,
            key_hash=hash_api_key(secret),
            scopes=list(payload.scopes),
            status="active",
            expires_at=payload.expires_at,
        )
        db.add(key)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # A duplicate name is actionable; a random-prefix collision is retried.
            existing = next(
                (item for item in api_key_repo.list_for_company(db, company_id=company_id) if item.name == payload.name),
                None,
            )
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An API key with this name already exists",
                )
            continue
        db.refresh(key)
        return CreatedApiAccessKey(key=key, secret=secret)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not issue an API key. Try again.",
    )


def revoke_key(
    db: Session,
    *,
    current_user: User,
    key_id: int,
) -> ApiAccessKey:
    company_id = _require_company_api_access(db, current_user)
    key = api_key_repo.get_for_company(
        db,
        company_id=company_id,
        key_id=key_id,
        for_update=True,
    )
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    if key.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This API key is already revoked",
        )
    key.status = "revoked"
    key.revoked_at = utcnow()
    key.revoked_by_user_id = current_user.id
    db.commit()
    db.refresh(key)
    return key


def _safe_audit_detail(details: object, key: str) -> str | None:
    if not isinstance(details, dict):
        return None
    value = details.get(key)
    return value if isinstance(value, str) else None


def list_usage(
    db: Session,
    *,
    current_user: User,
    key_id: int,
    limit: int,
) -> list[dict]:
    """Return the safe, per-key slice of public API audit history."""

    company_id = _require_company_api_access(db, current_user)
    key = api_key_repo.get_for_company(db, company_id=company_id, key_id=key_id)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    events = audit_log_repo.list_api_key_usage(
        db,
        company_id=company_id,
        api_key_id=key.id,
        limit=limit,
    )
    history = []
    for event in events:
        scope = _safe_audit_detail(event.details, "scope")
        history.append(
            {
                "id": event.id,
                "scope": scope if scope in KNOWN_SCOPES else None,
                "method": _safe_audit_detail(event.details, "method"),
                "path": _safe_audit_detail(event.details, "path"),
                "created_at": event.created_at,
            }
        )
    return history


def authenticate_key(
    db: Session,
    *,
    raw_key: str | None,
    required_scope: str,
) -> ApiAccessPrincipal:
    if not raw_key or not raw_key.startswith("whk_") or len(raw_key) > 256:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    key = api_key_repo.get_active_by_hash(
        db,
        key_hash=hash_api_key(raw_key),
        now=utcnow(),
    )
    if key is None or key.company is None or not key.company.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    require_company_access(key.company)
    require_company_feature(db, company_id=key.company_id, code=API_FEATURE_CODE)
    if required_scope not in key.scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This API key does not include the required scope",
        )
    return ApiAccessPrincipal(key=key, company_id=key.company_id, scope=required_scope)
