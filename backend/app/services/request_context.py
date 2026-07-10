import ipaddress
from functools import lru_cache

import httpx
from fastapi import Request


def _is_public_ip(value: str | None) -> bool:
    if not value:
        return False
    try:
        return ipaddress.ip_address(value).is_global
    except ValueError:
        return False


def get_client_ip(request: Request) -> str | None:
    # Uvicorn resolves proxy headers only from configured proxy IPs. Reading
    # X-Forwarded-For here directly lets clients spoof rate-limit/audit IPs.
    return request.client.host if request.client else None


@lru_cache(maxsize=2048)
def _lookup_public_ip_location(ip_address: str) -> dict:
    try:
        response = httpx.get(
            f"https://ipwho.is/{ip_address}",
            headers={"User-Agent": "WorkHive traffic analytics"},
            timeout=2.0,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return {}

    if not payload.get("success"):
        return {}

    return {
        "country": payload.get("country"),
        "region": payload.get("region"),
        "city": payload.get("city"),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
    }


def get_request_location_details(request: Request) -> dict:
    client_ip = get_client_ip(request)
    geo = {
        "country": request.headers.get("x-vercel-ip-country")
        or request.headers.get("cf-ipcountry"),
        "region": request.headers.get("x-vercel-ip-country-region")
        or request.headers.get("cf-region"),
        "city": request.headers.get("x-vercel-ip-city")
        or request.headers.get("cf-ipcity"),
        "latitude": request.headers.get("x-vercel-ip-latitude"),
        "longitude": request.headers.get("x-vercel-ip-longitude"),
    }
    if not geo["latitude"] and not geo["longitude"] and _is_public_ip(client_ip):
        looked_up_geo = _lookup_public_ip_location(client_ip)
        geo = {key: geo.get(key) or looked_up_geo.get(key) for key in geo}

    return {
        "ip": client_ip,
        "user_agent": request.headers.get("user-agent"),
        "accept_language": request.headers.get("accept-language"),
        "geo": geo,
    }
