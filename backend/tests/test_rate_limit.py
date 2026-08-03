import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.rate_limit import enforce_rate_limit, rate_limiter


def _request(ip_address: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": (ip_address, 8000),
        }
    )


def test_rate_limit_blocks_identity_rotation_from_one_ip():
    request = _request("198.51.100.10")

    enforce_rate_limit(request, "login", 2, 60, identity="first@example.com")
    enforce_rate_limit(request, "login", 2, 60, identity="second@example.com")

    with pytest.raises(HTTPException, match="Too many requests") as error:
        enforce_rate_limit(request, "login", 2, 60, identity="third@example.com")

    assert error.value.status_code == 429


def test_rate_limit_blocks_distributed_attempts_against_one_identity():
    enforce_rate_limit(
        _request("198.51.100.10"),
        "login",
        2,
        60,
        identity="target@example.com",
    )
    enforce_rate_limit(
        _request("198.51.100.11"),
        "login",
        2,
        60,
        identity="target@example.com",
    )

    with pytest.raises(HTTPException, match="Too many requests") as error:
        enforce_rate_limit(
            _request("198.51.100.12"),
            "login",
            2,
            60,
            identity="target@example.com",
        )

    assert error.value.status_code == 429
    assert all("target@example.com" not in key for key in rate_limiter._attempts)
