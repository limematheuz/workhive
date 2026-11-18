from datetime import datetime, timezone
from app.models.client_opportunity import OPPORTUNITY_STAGES
from app.repositories import commercial_workspace as repo
from app.schemas.client_sales import ClientOpportunityResponse
from app.services import client_authorization_service as access
from app.services.organization_authorization_service import has_capability
from app.services.company_preferences_service import preferences
from app.services.entitlement_service import company_feature_enabled

def read(db, user, search='', stage=None, attention=False, offset=0):
    company = access.require_client_capability(db, user, access.CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ)
    now = datetime.now(timezone.utc)
    records = repo.page(db, company, search, stage, attention, now, offset)
    quotes = repo.linked_quotes(db, company, [item.id for item, _, _ in records[:100]])
    by_opportunity = {}
    for opportunity, id, number, status in quotes:
        by_opportunity.setdefault(opportunity, []).append(dict(id=id, number=number, status=status))
    items = []
    for record, name, relationship in records[:100]:
        row = ClientOpportunityResponse.model_validate(record).model_dump()
        for key in ('created_at', 'updated_at', 'next_follow_up_at'):
            value = row[key]
            if value is not None:
                row[key] = value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
        row.update(client_name=name, relationship_status=relationship, linked_quotes=by_opportunity.get(record.id, []))
        items.append(row)
    stages, overdue, unscheduled, leads = repo.summary(db, company, now)
    closed = stages.get('won', 0) + stages.get('lost', 0)
    quotes_enabled = company_feature_enabled(db, company_id=company, code='features.quotes')
    can_view_quotes = quotes_enabled and has_capability(db, user, 'finance.read')
    return dict(
        timezone=preferences(db, company)['timezone'],
        items=items,
        has_more=len(records) > 100,
        summary=dict(
            stages={stage: stages.get(stage, 0) for stage in OPPORTUNITY_STAGES},
            overdue=overdue,
            unscheduled=unscheduled,
            leads=leads,
            win_rate=round(stages.get('won', 0) * 100 / closed, 1) if closed else None,
        ),
        access=dict(
            can_manage=access.has_client_capability(db, user, access.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE),
            can_create_account=access.has_client_capability(db, user, access.CAPABILITY_CLIENTS_MANAGE),
            can_view_quotes=can_view_quotes,
            can_calculate=can_view_quotes and has_capability(db, user, 'finance.manage') and has_capability(db, user, 'labor_costs.read'),
        ),
    )

def accounts(db, user, search=''):
    company = access.require_client_capability(db, user, access.CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ)
    return [dict(id=id, name=name, relationship_status=relationship) for id, name, relationship in repo.accounts(db, company, search)]
