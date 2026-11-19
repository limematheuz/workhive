from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

engine_options: dict[str, object] = {"pool_pre_ping": True}
if settings.use_null_pool:
    engine_options["poolclass"] = NullPool
else:
    engine_options.update(
        {
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_recycle": settings.DATABASE_POOL_RECYCLE_SECONDS,
        }
    )

engine = create_engine(settings.sync_database_url, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Financial period rules are enforced for synchronous and async ORM sessions.
from app.services.accounting_period_guard import install as install_accounting_period_guard
install_accounting_period_guard()

from app.services.task_closure_guard import install as install_task_closure_guard
install_task_closure_guard()

from app.services.membership_session_guard import install as install_membership_session_guard
install_membership_session_guard()
