from sqlalchemy.engine import make_url


def _replace_driver(database_url: str, drivername: str) -> str:
    return make_url(database_url).set(drivername=drivername).render_as_string(
        hide_password=False
    )


def to_sync_database_url(database_url: str) -> str:
    driver = make_url(database_url).drivername
    if driver in {"postgres", "postgresql", "postgresql+psycopg2", "postgresql+psycopg"}:
        return _replace_driver(database_url, "postgresql+psycopg")
    if driver in {"sqlite", "sqlite+pysqlite"}:
        return _replace_driver(database_url, "sqlite+pysqlite")
    if driver == "sqlite+aiosqlite":
        return _replace_driver(database_url, "sqlite+pysqlite")
    raise ValueError(f"Unsupported database scheme: {driver}")


def to_async_database_url(database_url: str) -> str:
    driver = make_url(database_url).drivername
    if driver in {"postgres", "postgresql", "postgresql+psycopg2", "postgresql+psycopg"}:
        return _replace_driver(database_url, "postgresql+psycopg")
    if driver in {"sqlite", "sqlite+pysqlite", "sqlite+aiosqlite"}:
        return _replace_driver(database_url, "sqlite+aiosqlite")
    raise ValueError(f"Unsupported database scheme: {driver}")
