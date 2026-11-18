"""Self workspace identity; employment records never provision software accounts."""
from fastapi import HTTPException
from app.repositories import organization as organization_repo, staff_account as staff_repo, subscription_entitlement as entitlement_repo
from app.services.organization_bootstrap_service import ensure_legacy_membership
from app.services.user_scope import require_company_context
from app.services.entitlement_service import resolve_effective_entitlements
from app.services.organization_authorization_service import permitted_location_ids


def context(db, user):
    if not user.role or user.role.name not in {"admin", "manager", "viewer"}:
        raise HTTPException(403, "Se necesita una cuenta interna de empresa.")
    company = require_company_context(user)
    membership = organization_repo.get_user_membership(db, company_id=company, user_id=user.id)
    if membership is None:
        membership = ensure_legacy_membership(db, user, existing_membership=membership)
    if membership is None or membership.status != "active":
        raise HTTPException(403, "Se necesita una membresía interna activa.")
    current_company=entitlement_repo.get_company(db,company_id=company)
    if current_company is None or not current_company.is_active:
        raise HTTPException(403, "La empresa no está activa.")
    employee = staff_repo.own_employee(db, company, user.id)
    features = resolve_effective_entitlements(db, current_company).values
    try:
        locations = permitted_location_ids(db, user, "time.manage")
        can_track_time = locations is None or bool(locations)
    except HTTPException as error:
        if error.status_code != 403:
            raise
        can_track_time = False
    return dict(employee=dict(id=employee.id, name=employee.name, position=employee.position) if employee else None,
        can_track_time=can_track_time,
        features=[code for code, enabled in features.items() if code.startswith("features.") and enabled is True])
