from datetime import datetime, timedelta, timezone
from app.models.client import Client
from app.models.client_opportunity import ClientOpportunity
from app.models.client_portal_grant import ClientPortalGrant
from app.models.client_portal_invitation import ClientPortalInvitation
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from app.models.role import Role
from app.models.location import Location
from app.models.quote import Quote
from app.models.workforce_plan import QuoteWorkScope
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _user, _headers, _assign_company_profile

def account(db, company, name):
    row = Client(company_id=company.id, name=name, relationship_status='lead', address='Calle comercial 1', city='Madrid', postal_code='28001', country='España')
    db.add(row)
    db.flush()
    return row

def test_commercial_workspace_uses_same_crm_records_and_scopes(client, db):
    company = _company(db, 'global-crm')
    owner = _bootstrap_admin(db, company, 'global-crm')
    customer = account(db, company, 'Cliente buscado')
    other_company = _company(db, 'global-crm-other')
    other_owner = _bootstrap_admin(db, other_company, 'global-crm-other')
    foreign = account(db, other_company, 'Cliente oculto')
    db.add_all([ClientOpportunity(client_id=customer.id, title='Cristales por plantas', stage='qualified', next_follow_up_at=datetime.now(timezone.utc) - timedelta(days=1)), ClientOpportunity(client_id=foreign.id, title='No debe aparecer', stage='new')])
    db.commit()
    headers = _headers(owner)
    result = client.get('/api/v1/commercial-workspace', headers=headers)
    assert result.status_code == 200, result.text
    body = result.json()
    assert len(body['items']) == 1 and body['items'][0]['client_name'] == customer.name
    assert body['summary']['overdue'] == 1 and body['summary']['stages']['qualified'] == 1
    assert body['summary']['win_rate'] is None
    item = body['items'][0]
    updated = client.patch(f"/api/v1/clients/{customer.id}/opportunities/{item['id']}", headers=headers, json={'stage': 'won'})
    assert updated.status_code == 200, updated.text
    assert client.get('/api/v1/commercial-workspace', headers=headers).json()['summary']['win_rate'] == 100
    history = client.get(f"/api/v1/clients/{customer.id}/opportunities/{item['id']}/activities", headers=headers)
    assert history.status_code == 200 and history.json()[0]['activity_type'] == 'stage_change'
    assert client.get('/api/v1/commercial-workspace?search=oculto', headers=headers).json()['items'] == []
    assert client.get('/api/v1/commercial-workspace', headers=_headers(other_owner)).json()['items'][0]['title'] == 'No debe aparecer'
    reader = _user(db, company, 'global-crm-reader', role_id=3)
    _assign_company_profile(db, company=company, admin=owner, user=reader, name='Solo seguimiento comercial', permission_codes={'commercial.follow_ups.read'})
    readonly = client.get('/api/v1/commercial-workspace', headers=_headers(reader))
    assert readonly.status_code == 200, readonly.text
    assert readonly.json()['access']['can_manage'] is False
    assert client.patch(f"/api/v1/clients/{customer.id}/opportunities/{item['id']}", headers=_headers(reader), json={'stage': 'qualified'}).status_code == 403
    assert client.get('/api/v1/commercial-workspace/accounts', headers=_headers(reader)).json()[0]['id'] == customer.id
    unauthorized = _user(db, company, 'global-crm-no-access', role_id=3)
    db.commit()
    assert client.get('/api/v1/commercial-workspace', headers=_headers(unauthorized)).status_code == 403

def test_portal_hub_keeps_customer_and_adviser_grants_separate(client, db):
    company = _company(db, 'portal-hub')
    company.subscription_plan = 'top'
    owner = _bootstrap_admin(db, company, 'portal-hub')
    customer = account(db, company, 'Cliente con acceso')
    portal_role = db.query(Role).filter_by(name='client_portal').one()
    portal = _user(db, None, 'portal-hub-customer', role_id=portal_role.id)
    db.add(ClientPortalGrant(company_id=company.id, client_id=customer.id, user_id=portal.id, status='active', granted_by_user_id=owner.id))
    advisory_role = db.query(Role).filter_by(name='external_portal').one()
    adviser = _user(db, company, 'portal-hub-adviser', role_id=advisory_role.id)
    grant = ExternalAccessGrant(company_id=company.id, user_id=adviser.id, access_type='accountant', status='active')
    db.add(grant)
    db.flush()
    db.add(AdvisoryAccess(grant_id=grant.id, accounting=False, payroll=True))
    other = _company(db, 'portal-hub-other')
    other_owner = _bootstrap_admin(db, other, 'portal-hub-other')
    foreign = account(db, other, 'Cliente de otra sociedad')
    db.add(ClientPortalGrant(company_id=other.id, client_id=foreign.id, user_id=portal.id, status='active', granted_by_user_id=other_owner.id))
    db.commit()
    result = client.get('/api/v1/portal-workspace', headers=_headers(owner))
    assert result.status_code == 200, result.text
    body = result.json()
    assert [c['id'] for c in body['clients']] == [customer.id]
    assert body['summary']['active_client_accesses'] == 1
    assert body['modules']['worker_app'] is True
    assert body['clients'][0]['grants'][0]['email'] == portal.email
    assert body['advisers'][0]['email'] == adviser.email
    assert body['advisers'][0]['accounting'] is False and body['advisers'][0]['payroll'] is True
    assert client.get('/api/v1/portal-workspace', headers=_headers(portal)).status_code == 403
    assert client.get('/api/v1/portal-workspace', headers=_headers(adviser)).status_code == 403
    worker = _user(db, company, 'portal-hub-worker', role_id=3)
    db.commit()
    assert client.get('/api/v1/portal-workspace', headers=_headers(worker)).status_code == 403

def test_hub_marks_expired_access_and_excludes_inactive_pending_invites(client, db):
    company = _company(db, 'hub-expiry')
    owner = _bootstrap_admin(db, company, 'hub-expiry')
    customer = account(db, company, 'Cliente vigente')
    inactive = account(db, company, 'Cliente archivado')
    inactive.is_active = False
    portal_role = db.query(Role).filter_by(name='client_portal').one()
    portal = _user(db, None, 'hub-expiry-customer', role_id=portal_role.id)
    now = datetime.now(timezone.utc)
    db.add(ClientPortalGrant(company_id=company.id, client_id=customer.id, user_id=portal.id, status='active', expires_at=now - timedelta(days=1), granted_by_user_id=owner.id))
    for sequence, (customer_id, days) in enumerate([(customer.id, 1), (customer.id, -1), (inactive.id, 1)]):
        db.add(ClientPortalInvitation(company_id=company.id, client_id=customer_id, email=f'test{sequence}@example.test', status='pending', token_hash=f'token{sequence}', verification_code_hash=f'code{sequence}', expires_at=now + timedelta(days=days)))
    db.commit()
    response = client.get('/api/v1/portal-workspace', headers=_headers(owner))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['summary'] == {'active_client_accesses': 0, 'pending_invitations': 1}
    assert [row['id'] for row in body['clients']] == [customer.id]
    assert body['clients'][0]['grants'][0]['status'] == 'expired'
    assert {row['status'] for row in body['clients'][0]['invitations']} == {'pending', 'expired'}
    assert 'token_hash' not in response.text and 'verification_code_hash' not in response.text

def test_commercial_linked_quotes_require_same_client_and_company(client, db):
    company = _company(db, 'crm-quotes')
    owner = _bootstrap_admin(db, company, 'crm-quotes')
    customer = account(db, company, 'Cliente del presupuesto')
    other = account(db, company, 'Otro cliente')
    location = Location(name='Oficinas', address='Calle 1', city='Madrid', owner_company_id=company.id, client_id=customer.id)
    opportunity = ClientOpportunity(client_id=customer.id, title='Servicio por plantas', stage='proposal')
    db.add_all([location, opportunity])
    db.flush()
    quote = Quote(company_id=company.id, client_id=customer.id, quote_number='P-CRM-001', title='Presupuesto vinculado', status='draft')
    wrong = Quote(company_id=company.id, client_id=other.id, quote_number='P-CRM-002', title='No coincide el cliente', status='sent')
    db.add_all([quote, wrong])
    db.flush()
    for row in (quote, wrong):
        db.add(QuoteWorkScope(quote_id=row.id, company_id=company.id, location_id=location.id, opportunity_id=opportunity.id, configuration={}))
    db.commit()
    response = client.get('/api/v1/commercial-workspace', headers=_headers(owner))
    assert response.status_code == 200, response.text
    assert response.json()['items'][0]['linked_quotes'] == [{'id': quote.id, 'number': 'P-CRM-001', 'status': 'draft'}]
