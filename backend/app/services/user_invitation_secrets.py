"""One-way invitation verification helpers shared by creation and acceptance."""

import hashlib
import secrets
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_code() -> str:
    return f"{secrets.randbelow(100_000_000):08d}"
