from inspect import iscoroutinefunction, signature

from sqlalchemy.orm import Session

from app.main import app


def iter_routes(router):
    for route in router.routes:
        included_router = getattr(route, "original_router", None)
        if included_router is not None:
            yield from iter_routes(included_router)
        else:
            yield route


def test_async_http_endpoints_never_receive_a_synchronous_database_session():
    unsafe: list[str] = []
    for route in iter_routes(app.router):
        endpoint = getattr(route, "endpoint", None)
        if endpoint is None or not iscoroutinefunction(endpoint):
            continue
        parameter = signature(endpoint).parameters.get("db")
        if parameter and parameter.annotation is Session:
            unsafe.append(getattr(route, "path", endpoint.__name__))

    assert unsafe == []
