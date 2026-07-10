from collections import defaultdict, deque
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
    return f"{scope}:{client_ip}:{normalized_identity}"
