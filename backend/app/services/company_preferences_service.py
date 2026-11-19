from fastapi import HTTPException
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.models.company_preferences import CompanyPreferences
from app.repositories import company_preferences as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


def preferences(db, company):
    settings = repo.get(db, company)
    return dict(country=settings.country, currency=settings.currency, timezone=settings.timezone,
                language=settings.language) if settings else dict(country="ES",currency="EUR",timezone="Europe/Madrid",language="es")


def read(db, user):
    from app.services.company_hierarchy_service import parent
    company=require_company_context(user)
    return dict(**preferences(db,company),company_id=company,parent_company_id=parent(db,company))


def save(db, user, payload):
    company = require_company_context(user)
    require_capability(db, user, "access.members.manage")
    try:
        ZoneInfo(payload.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Zona horaria desconocida.")
    settings = repo.get(db, company)
    if settings is None:
        settings = CompanyPreferences(company_id=company)
        db.add(settings)
    from app.services.company_hierarchy_service import save as save_parent
    save_parent(db,user,company,payload.parent_company_id)
    for key, value in payload.model_dump(exclude={"parent_company_id"}).items():
        setattr(settings, key, value)
    db.commit()
    return read(db,user)
