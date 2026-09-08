from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.services.storage_service import get_object_storage


REQUIRED_SCHEMA_TABLES = frozenset(
    {
        "task_assignments",
        "task_checklist_items",
        "task_checklist_assignments",
    }
)
REQUIRED_SCHEMA_COLUMNS = {
    "companies": frozenset({"operating_model"}),
    # Expenses are read by both the expenses workspace and finance analytics.
    # Keep this column in readiness so a database that predates client cost
    # attribution is declared unavailable before those views can return 500.
    "expenses": frozenset({"client_id"}),
}


def required_schema_is_ready(db: Session) -> bool:
    inspector = inspect(db.get_bind())
    if not all(inspector.has_table(table) for table in REQUIRED_SCHEMA_TABLES):
        return False

    for table, required_columns in REQUIRED_SCHEMA_COLUMNS.items():
        if not inspector.has_table(table):
            return False
        actual_columns = {
            column["name"] for column in inspector.get_columns(table)
        }
        if not required_columns <= actual_columns:
            return False
    return True


def readiness_checks(db: Session) -> dict[str, dict[str, str]]:
    checks: dict[str, dict[str, str]] = {}
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception:
        checks["database"] = {"status": "error"}

    try:
        checks["schema"] = {
            "status": "ok" if required_schema_is_ready(db) else "error"
        }
    except Exception:
        checks["schema"] = {"status": "error"}

    try:
        get_object_storage().check()
        checks["invoice_storage"] = {"status": "ok"}
    except Exception:
        checks["invoice_storage"] = {"status": "error"}

    try:
        get_object_storage().check()
        checks["media_storage"] = {"status": "ok"}
    except Exception:
        checks["media_storage"] = {"status": "error"}
    return checks
