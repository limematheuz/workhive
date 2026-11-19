"""Transaction-local scalar auditing with no record reloads or table scans."""
from datetime import date, datetime
from decimal import Decimal
from itertools import chain
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.core.datetime import as_utc
from app.services.record_history_catalog import TRACKED, PROFILE_FIELDS

ACTOR_KEY = "record_history_actor"
PENDING_KEY = "record_history_pending"


def bind_actor(db, user):
    session = getattr(db, "sync_session", None) or getattr(db, "session", None) or db
    if not isinstance(session, Session):
        return
    session.info.pop(ACTOR_KEY, None)
    if user.company_id and user.role and user.role.name not in {"superadmin", "external_portal", "partner_portal", "client_portal"}:
        session.info[ACTOR_KEY] = (user.id, user.company_id)


def clear_actor(db):
    session = getattr(db, "sync_session", None) or getattr(db, "session", None) or db
    if isinstance(session, Session):
        session.info.pop(ACTOR_KEY, None)


def scalar(value):
    if isinstance(value, datetime):
        return as_utc(value).isoformat()
    if isinstance(value, (date, Decimal)):
        return str(value)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return value[:240] if isinstance(value, str) else None


@event.listens_for(Session, "before_flush")
def collect_changes(session, flush_context, instances):
    actor = session.info.get(ACTOR_KEY)
    if not actor:
        return
    pending = []
    for item in chain(session.new, session.dirty, session.deleted):
        spec = TRACKED.get(getattr(item, "__tablename__", ""))
        if spec is None:
            continue
        state = inspect(item)
        company = state.dict.get("company_id", state.dict.get("owner_company_id"))
        if company != actor[1]:
            continue
        created = item in session.new
        deleted = item in session.deleted
        changes = []
        for field in spec[1]:
            history = state.attrs[field].history
            if not created and not deleted and not history.has_changes():
                continue
            before = history.deleted[0] if history.deleted else state.dict.get(field) if deleted else None
            after = None if deleted else state.dict.get(field)
            if created and after is None:
                continue
            changes.append(dict(field=field, before=scalar(before), after=scalar(after), before_known=created or deleted or bool(history.deleted)))
        if spec[0] == "staff_employee" and state.attrs.profile.history.has_changes():
            history = state.attrs.profile.history
            old = history.deleted[0] if history.deleted and isinstance(history.deleted[0], dict) else {}
            new = state.dict.get("profile") or {}
            for key in PROFILE_FIELDS:
                if old.get(key) != new.get(key):
                    changes.append(dict(field="profile."+key, before=scalar(old.get(key)), after=scalar(new.get(key)), before_known=created or bool(history.deleted)))
        if changes or created or deleted:
            pending.append((item, spec[0], "created" if created else "deleted" if deleted else "updated", actor, changes))
    session.info[PENDING_KEY] = pending


@event.listens_for(Session, "after_flush_postexec")
def persist_changes(session, flush_context):
    pending = session.info.pop(PENDING_KEY, [])
    if not pending:
        return
    from app.models.audit_log import AuditLog
    rows = [dict(company_id=actor[1], actor_user_id=actor[0], action="record."+operation, entity_type=entity_type,
        entity_id=str(item.__dict__["id"]), details={"changes":changes}) for item, entity_type, operation, actor, changes in pending if item.__dict__.get("id") is not None]
    if rows:
        session.connection().execute(AuditLog.__table__.insert(), rows)


@event.listens_for(Session, "after_rollback")
def discard_changes(session):
    session.info.pop(PENDING_KEY, None)
