from collections import defaultdict, deque
from hashlib import sha256
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

from app.services.request_context import get_client_ip


class InMemoryRateLimiter:
    """Process-local rate limiter.

    Multi-worker deployments should put a reverse-proxy / WAF rate limit in
    front of the API. This limiter still protects single-process and local
    environments and remains the shared interface for all auth endpoints.
    """

    def __init__(self) -> None:
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def enforce(self, key: str, limit: int, window_seconds: int) -> None:
        now = monotonic()
        cutoff = now - window_seconds

        with self._lock:
            attempts = self._attempts[key]
            while attempts and attempts[0] <= cutoff:
                attempts.popleft()

            if len(attempts) >= limit:
                retry_after = max(1, int(window_seconds - (now - attempts[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

            attempts.append(now)


rate_limiter = InMemoryRateLimiter()


def rate_limit_key(request: Request, scope: str, identity: str = "") -> str:
    client_ip = get_client_ip(request) or "unknown"
    normalized_identity = identity.strip().lower()
    identity_hash = (
        sha256(normalized_identity.encode("utf-8")).hexdigest()
        if normalized_identity
        else ""
    )
    return f"{scope}:{client_ip}:{identity_hash}"


def identity_rate_limit_key(scope: str, identity: str) -> str:
    """Return a non-reversible shared limit key for an account or token."""
    normalized_identity = identity.strip().lower()
    if not normalized_identity:
        raise ValueError("A rate-limited identity cannot be empty")
    identity_hash = sha256(normalized_identity.encode("utf-8")).hexdigest()
    return f"{scope}:identity:{identity_hash}"


def enforce_rate_limit(
    request: Request,
    scope: str,
    limit: int,
    window_seconds: int,
    *,
    identity: str = "",
    identity_limit: int | None = None,
) -> None:
    """Apply independent per-IP and per-identity limits.

    A combined IP-and-identity key can be bypassed either by rotating IPs or by
    changing identities. Keeping both dimensions makes public forms resistant
    to credential stuffing and automated account creation while avoiding raw
    email addresses or tokens in the limiter state.
    """
    rate_limiter.enforce(
        rate_limit_key(request, scope),
        limit,
        window_seconds,
    )
    if identity.strip():
        rate_limiter.enforce(
            identity_rate_limit_key(scope, identity),
            identity_limit if identity_limit is not None else limit,
            window_seconds,
        )
