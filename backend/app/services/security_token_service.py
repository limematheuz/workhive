from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.consumed_security_token import ConsumedSecurityToken


def consume_token(
    db: Session,
    *,
    jti: str | None,
    purpose: str,
    expires_at: datetime | None,
) -> None:
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security token is missing a unique identifier",
        )

    existing = (
        db.query(ConsumedSecurityToken)
        .filter(ConsumedSecurityToken.jti == jti)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This security token has already been used",
        )

    if expires_at is None:
        expires_at = datetime.now(timezone.utc)
    elif expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    db.add(
        ConsumedSecurityToken(
            jti=jti,
            purpose=purpose,
            expires_at=expires_at,
        )
    )
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This security token has already been used",
        ) from exc


def purge_expired_tokens(db: Session) -> int:
    deleted = (
        db.query(ConsumedSecurityToken)
        .filter(ConsumedSecurityToken.expires_at < datetime.now(timezone.utc))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted
