from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import jwt
import bcrypt
from app.core.config import settings


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {
        "sub": email,
        "exp": expire,
        "type": "password_reset",
        "jti": uuid4().hex,
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_password_reset_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "password_reset":
            return None
        if not payload.get("sub") or not payload.get("jti"):
            return None
        return payload
    except jwt.JWTError:
        return None


def create_email_change_token(
    *,
    user_id: int,
    current_email: str,
    new_email: str,
    session_version: int,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": str(user_id),
        "current_email": current_email,
        "new_email": new_email,
        "ver": session_version,
        "exp": expire,
        "type": "email_change",
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_email_change_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if payload.get("type") != "email_change":
            return None
        if not all(
            (
                payload.get("sub"),
                payload.get("current_email"),
                payload.get("new_email"),
                payload.get("jti"),
            )
        ):
            return None
        if not isinstance(payload.get("ver"), int):
            return None
        return payload
    except jwt.JWTError:
        return None
