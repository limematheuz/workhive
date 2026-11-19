"""Search only the scalar columns of authorized company records."""
from sqlalchemy import and_, or_
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.quote import Quote
from app.models.staff_employee import StaffEmployee
from app.repositories.workspace_search_text import Hit, context, window


def clients(db, access, term, limit):
    query = db.query(Client.id, Client.name, Client.address, Client.city, Client.relationship_status).filter(
        Client.company_id == access.company_id, Client.is_active.is_(True))
    rows = window(query, term, [Client.name, Client.address, Client.city],
        identifier=Client.id, title=Client.name, limit=limit)
    return [Hit(row.id, row.name, context(row.address, row.city), row.relationship_status,
        f"#{row.id}") for row in rows]


def locations(db, access, term, limit):
    query = db.query(Location.id, Location.name, Location.address, Location.city).outerjoin(Client).filter(
        Location.is_active.is_(True), Location.is_temporary.is_(False), or_(
            Location.owner_company_id == access.company_id, Location.managing_company_id == access.company_id,
            Client.company_id == access.company_id,
            Location.company_access.any(LocationCompanyAccess.company_id == access.company_id)))
    if access.location_ids is not None:
        query = query.filter(Location.id.in_(access.location_ids))
    rows = window(query, term, [Location.name, Location.address, Location.city], identifier=Location.id,
        title=Location.name, limit=limit)
    return [Hit(row.id, row.name, context(row.address, row.city), "active", f"#{row.id}") for row in rows]


def invoices(db, access, term, limit):
    query = db.query(Invoice.id, Invoice.invoice_number, Invoice.status, Invoice.issue_date, Client.name).outerjoin(
        Client, and_(Client.id == Invoice.client_id, Client.company_id == access.company_id)).filter(
        Invoice.company_id == access.company_id, Invoice.is_active.is_(True))
    rows = window(query, term, [Invoice.invoice_number, Client.name], identifier=Invoice.id,
        title=Invoice.invoice_number, reference=Invoice.invoice_number, date=Invoice.issue_date, limit=limit)
    return [Hit(row.id, row.invoice_number, context(row.name), row.status, row.invoice_number, row.issue_date) for row in rows]


def quotes(db, access, term, limit):
    query = db.query(Quote.id, Quote.quote_number, Quote.title, Quote.status, Quote.created_at, Client.name).outerjoin(
        Client, and_(Client.id == Quote.client_id, Client.company_id == access.company_id)).filter(
        Quote.company_id == access.company_id, Quote.is_active.is_(True))
    rows = window(query, term, [Quote.title, Quote.quote_number, Client.name], identifier=Quote.id,
        title=Quote.title, reference=Quote.quote_number, date=Quote.created_at, limit=limit)
    return [Hit(row.id, row.title, context(row.name), row.status, row.quote_number, row.created_at) for row in rows]


def staff(db, access, term, limit):
    state = StaffEmployee.profile["state"].as_string().label("state")
    query = db.query(StaffEmployee.id, StaffEmployee.name, StaffEmployee.position, StaffEmployee.team, state).filter(
        StaffEmployee.company_id == access.company_id)
    rows = window(query, term, [StaffEmployee.name, StaffEmployee.position, StaffEmployee.team],
        identifier=StaffEmployee.id, title=StaffEmployee.name, limit=limit)
    return [Hit(row.id, row.name, context(row.position, row.team), row.state, f"#{row.id}") for row in rows]
