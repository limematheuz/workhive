from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
import logging
import secrets
import time
import uuid
import asyncio
from contextlib import asynccontextmanager
from app.db import base as _models
from app.api.deps import get_db
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.services.health_service import readiness_checks
from app.services.calendar_background_service import periodic_calendar_sync
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware


configure_logging()
logger = logging.getLogger("workhive.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = (
        asyncio.create_task(periodic_calendar_sync())
        if settings.RUN_CALENDAR_BACKGROUND_SYNC
        else None
    )
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="WorkHive API",
    description="API for the WorkHive management system",
    version=settings.VERSION,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

from starlette.middleware.trustedhost import TrustedHostMiddleware as _TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send


HEALTH_PROBE_PATHS = {"/health", "/health/ready"}


class TrustedHostMiddleware(_TrustedHostMiddleware):
    """Skip trusted-host enforcement for internal health-check probes."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path") in HEALTH_PROBE_PATHS:
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


class ExemptHTTPSRedirectMiddleware(HTTPSRedirectMiddleware):
    """Skip HTTPS redirect for internal Docker health probes (plain HTTP)."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path") in HEALTH_PROBE_PATHS:
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


if settings.FORCE_HTTPS:
    app.add_middleware(ExemptHTTPSRedirectMiddleware)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
        "X-Request-ID",
    ],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def enforce_csrf_for_cookie_sessions(request, call_next):
    unsafe_method = request.method in {"POST", "PUT", "PATCH", "DELETE"}
    session_cookie = request.cookies.get(settings.SESSION_COOKIE_NAME)
    bearer_authorization = request.headers.get("Authorization", "").startswith("Bearer ")
    exempt_path = request.url.path in {
        f"{settings.API_V1_STR}/auth/login",
        f"{settings.API_V1_STR}/auth/register",
        f"{settings.API_V1_STR}/auth/forgot-password",
        f"{settings.API_V1_STR}/auth/reset-password",
        f"{settings.API_V1_STR}/user-invitations/accept",
        f"{settings.API_V1_STR}/contact/",
        f"{settings.API_V1_STR}/trial-requests/",
        f"{settings.API_V1_STR}/trial-requests/verify",
    }

    if unsafe_method and session_cookie and not bearer_authorization and not exempt_path:
        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        csrf_header = request.headers.get("X-CSRF-Token")
        if (
            not csrf_cookie
            or not csrf_header
            or not secrets.compare_digest(csrf_cookie, csrf_header)
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid or missing CSRF token"},
            )

    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
    if (
        request.cookies.get(settings.SESSION_COOKIE_NAME)
        or request.headers.get("Authorization")
    ) and "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "private, no-store"
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    supplied_request_id = request.headers.get("X-Request-ID", "")
    request_id_is_safe = all(
        character.isalnum() or character in {"-", "_", "."}
        for character in supplied_request_id
    )
    request_id = (
        supplied_request_id
        if (
            0 < len(supplied_request_id) <= 64
            and supplied_request_id.isascii()
            and request_id_is_safe
        )
        else str(uuid.uuid4())
    )
    request.state.request_id = request_id
    started_at = time.perf_counter()
    log_fields = {
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host if request.client else None,
    }
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request error", extra=log_fields)
        raise
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response_fields = {
        **log_fields,
        "status_code": response.status_code,
        "duration_ms": duration_ms,
    }
    if response.status_code >= 500:
        logger.error("Request completed", extra=response_fields)
    elif response.status_code >= 400:
        logger.warning("Request completed", extra=response_fields)
    else:
        logger.debug("Request completed", extra=response_fields)
    return response


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health_check():
    return JSONResponse(
        content={"status": "ok", "message": "WorkHive API is running"}, status_code=200
    )

@app.get("/health/ready", tags=["System"])
def readiness_check(
    request: Request,
    db: Session = Depends(get_db),
):
    checks = readiness_checks(db)
    is_ready = all(check["status"] == "ok" for check in checks.values())
    # Public liveness stays at /health. Ready details are for orchestrators:
    # return a coarse status unless an internal probe header is present.
    probe_token = request.headers.get("X-WorkHive-Ready-Token")
    expected = settings.HEALTH_READY_TOKEN
    if expected and (not probe_token or not secrets.compare_digest(probe_token, expected)):
        return JSONResponse(
            content={"status": "ok" if is_ready else "error"},
            status_code=200 if is_ready else 503,
        )
    return JSONResponse(
        content={
            "status": "ok" if is_ready else "error",
            "checks": checks,
        },
        status_code=200 if is_ready else 503,
    )
