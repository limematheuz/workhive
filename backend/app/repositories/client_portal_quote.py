"""Quote mutations and downloads remain bound to the exact customer grant."""
from sqlalchemy.orm import selectinload
from app.models.client_portal_grant import ClientPortalGrant
from app.models.quote import Quote


def lock_grant(db, grant_id, user_id):
    return db.query(ClientPortalGrant).filter_by(id=grant_id, user_id=user_id).with_for_update(of=ClientPortalGrant).populate_existing().one_or_none()


def quote(db, grant, quote_id, *, for_update=False):
    query = db.query(Quote).options(selectinload(Quote.items)).filter(
        Quote.id == quote_id, Quote.company_id == grant.company_id, Quote.client_id == grant.client_id,
        Quote.is_active.is_(True), Quote.status.in_(("sent", "accepted", "rejected", "expired")))
    if for_update:
        query = query.with_for_update(of=Quote).populate_existing()
    return query.one_or_none()
