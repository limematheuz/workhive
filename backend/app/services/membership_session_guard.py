"""Invalidate company sessions whenever an existing membership changes lifecycle."""
from sqlalchemy import event,inspect
from sqlalchemy.orm import Session
from app.core.datetime import as_utc
from app.repositories.membership_session import persisted_state


def _invalidate(session,flush_context,instances):
    from app.models.company_membership import CompanyMembership
    for member in session.dirty:
        if not isinstance(member,CompanyMembership):continue
        state=inspect(member)
        if not state.persistent:continue
        changed=[key for key in ("status","access_class","started_at","ended_at") if state.attrs[key].history.has_changes()]
        if not changed:continue
        unknown=any(not state.attrs[key].history.deleted for key in changed)
        persisted=persisted_state(session,member) if unknown else None
        def changed_value(key):
            history=state.attrs[key].history
            previous=history.deleted[0] if history.deleted else persisted[key] if persisted else None
            current=state.dict.get(key)
            if key.endswith("_at"):
                return (as_utc(previous) if previous else None)!=(as_utc(current) if current else None)
            return previous!=current
        if any(changed_value(key) for key in changed):
            member.session_version=(member.session_version or 0)+1


def install():
    if not event.contains(Session,"before_flush",_invalidate):
        event.listen(Session,"before_flush",_invalidate)
