"""Bounded company-wide commercial views over the existing CRM records."""
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from app.models.client import Client
from app.models.client_opportunity import ClientOpportunity
from app.models.company_membership import CompanyMembership
from app.models.quote import Quote
from app.models.workforce_plan import QuoteWorkScope

def query(db, company):
    return db.query(ClientOpportunity, Client.name, Client.relationship_status).join(Client, Client.id == ClientOpportunity.client_id).filter(Client.company_id == company, Client.is_active.is_(True), ClientOpportunity.is_active.is_(True))

def page(db, company, search, stage, attention, now, offset):
    rows = query(db, company).options(joinedload(ClientOpportunity.owner_membership).joinedload(CompanyMembership.user))
    if search:
        escaped = search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        rows = rows.filter(or_(Client.name.ilike('%' + escaped + '%', escape='\\'), ClientOpportunity.title.ilike('%' + escaped + '%', escape='\\')))
    if stage:
        rows = rows.filter(ClientOpportunity.stage == stage)
    if attention:
        rows = rows.filter(ClientOpportunity.stage.notin_(['won', 'lost']), or_(ClientOpportunity.next_follow_up_at.is_(None), ClientOpportunity.next_follow_up_at <= now))
    return rows.order_by(ClientOpportunity.next_follow_up_at.is_(None), ClientOpportunity.next_follow_up_at, ClientOpportunity.id.desc()).offset(offset).limit(101).all()

def summary(db, company, now):
    stages = dict(query(db, company).with_entities(ClientOpportunity.stage, func.count(ClientOpportunity.id)).group_by(ClientOpportunity.stage).all())
    overdue = query(db, company).filter(ClientOpportunity.stage.notin_(['won', 'lost']), ClientOpportunity.next_follow_up_at <= now).count()
    unscheduled = query(db, company).filter(ClientOpportunity.stage.notin_(['won', 'lost']), ClientOpportunity.next_follow_up_at.is_(None)).count()
    leads = db.query(func.count(Client.id)).filter(Client.company_id == company, Client.is_active.is_(True), Client.relationship_status == 'lead').scalar()
    return (stages, overdue, unscheduled, leads)

def accounts(db, company, search):
    rows = db.query(Client.id, Client.name, Client.relationship_status).filter(Client.company_id == company, Client.is_active.is_(True))
    if search:
        rows = rows.filter(Client.name.contains(search, autoescape=True))
    return rows.order_by(Client.name, Client.id).limit(100).all()

def linked_quotes(db, company, opportunity_ids):
    return db.query(QuoteWorkScope.opportunity_id, Quote.id, Quote.quote_number, Quote.status).join(Quote, Quote.id == QuoteWorkScope.quote_id).join(ClientOpportunity, ClientOpportunity.id == QuoteWorkScope.opportunity_id).filter(QuoteWorkScope.company_id == company, Quote.company_id == company, Quote.is_active.is_(True), Quote.client_id == ClientOpportunity.client_id, QuoteWorkScope.opportunity_id.in_(opportunity_ids)).order_by(Quote.id.desc()).all()
