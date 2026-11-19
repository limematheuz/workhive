"""Monotonic, relationship-local revocation for application-context tokens."""
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session


def _invalidate(session, flush_context, instances):
    from app.models.client_portal_grant import ClientPortalGrant
    from app.models.external_access_grant import ExternalAccessGrant
    from app.models.advisory_access import AdvisoryAccess
    from app.repositories.application_session import epoch_grant
    changed = {}
    for row in list(session.dirty):
        state = inspect(row)
        if not state.persistent:
            continue
        if isinstance(row, (ClientPortalGrant, ExternalAccessGrant)):
            fields = ["status", "user_id", "company_id", "expires_at", "revoked_at"]
            fields.append("client_id" if isinstance(row, ClientPortalGrant) else "access_type")
            if any(state.attrs[key].history.has_changes() for key in fields):
                changed[id(row)] = row
        elif isinstance(row, AdvisoryAccess) and any(state.attrs[key].history.has_changes()
                for key in ("accounting", "payroll", "can_close_periods")):
            grant = epoch_grant(session, row.grant_id)
            if grant is not None:
                changed[id(grant)] = grant
    for grant in changed.values():
        grant.session_version = (grant.session_version or 0) + 1


def install():
    if not event.contains(Session, "before_flush", _invalidate):
        event.listen(Session, "before_flush", _invalidate)
