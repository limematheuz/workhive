"""Independent commercial boundaries against persisted quota counters.

Capacity alone never grants a module: feature/role guards are tested separately.
The custom case is an explicitly provisioned Basic contract, not a fifth SKU.
"""

import pytest
from fastapi import HTTPException

from app.models.company_membership import CompanyMembership, Department, Team
from app.models.company_collaboration import CompanyCollaboration
from app.models.external_access_grant import ExternalAccessGrant
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.role import Role
from app.models.user import User
from app.services import company_entitlement_service, entitlement_service
from test_entitlement_service import make_company

QUOTAS = (
    "internal_admins",
    "internal_responsibles",
    "internal_workers",
    "departments",
    "teams",
    "accountant_portals",
    "partner_portals",
    "location_document_storage_bytes",
)
CONTRACTS = {
    "basic": (1, 2, 5, 1, 2, 1, 0, 1048576),
    "medium": (3, 8, 25, 5, 10, 2, 0, 1048576),
    "top": (10, 20, 100, 25, 50, 5, 2, 10485760),
    "mega": (25, 75, 500, 100, 250, 20, 10, 10485760),
    "custom": (2, 3, 7, 2, 3, 2, 1, 2097152),
}


def contract_company(db, plan):
    company = make_company(
        db,
        suffix="boundary-" + plan,
        plan="basic" if plan == "custom" else plan,
        status="active",
    )
    if plan == "custom":
        for quota, value in zip(QUOTAS, CONTRACTS[plan]):
            company_entitlement_service.set_company_entitlement_override(
                db,
                company_id=company.id,
                code="limits." + quota,
                value=value,
                reason="Explicit test contract",
                actor_user_id=None,
            )
        db.commit()
    return company


@pytest.mark.parametrize("plan", CONTRACTS)
@pytest.mark.parametrize("quota", QUOTAS[:-1])
def test_persisted_capacity_allows_last_slot_blocks_excess_and_releases_slot(
    db, plan, quota
):
    company = contract_company(db, plan)
    limit = CONTRACTS[plan][QUOTAS.index(quota)]
    assert (
        entitlement_service.entitlement_value(db, company, "limits." + quota) == limit
    )
    collaboration = None
    if quota == "partner_portals":
        partner = make_company(
            db, suffix="partner-" + plan, plan="none", status="inactive"
        )
        collaboration = CompanyCollaboration(
            initiator_company_id=company.id,
            partner_company_id=partner.id,
            status="accepted",
            role_type="property_manager",
        )
        db.add(collaboration)
        db.flush()

    def add(index):
        if quota == "departments":
            row = Department(
                company_id=company.id,
                name=f"Department {index}",
                normalized_name=f"department {index}",
            )
        elif quota == "teams":
            row = Team(company_id=company.id, name=f"Team {index}")
        else:
            role_name = (
                "external_portal"
                if quota == "accountant_portals"
                else "partner_portal"
                if quota == "partner_portals"
                else "viewer"
            )
            role = db.query(Role).filter_by(name=role_name).one()
            user = User(
                email=f"quota-{index}@example.test",
                hashed_password="unused",
                role_id=role.id,
                company_id=partner.id if collaboration else company.id,
                is_active=True,
            )
            db.add(user)
            db.flush()
            if quota == "accountant_portals":
                row = ExternalAccessGrant(
                    company_id=company.id,
                    user_id=user.id,
                    access_type="accountant",
                    status="active",
                )
            elif quota == "partner_portals":
                row = PartnerPortalGrant(
                    host_company_id=company.id,
                    partner_company_id=partner.id,
                    collaboration_id=collaboration.id,
                    user_id=user.id,
                    status="active",
                )
            else:
                access_class = {
                    "internal_admins": "admin",
                    "internal_responsibles": "responsible",
                    "internal_workers": "worker",
                }[quota]
                row = CompanyMembership(
                    company_id=company.id,
                    user_id=user.id,
                    access_class=access_class,
                    status="active",
                )
        db.add(row)
        db.flush()
        return row

    def check():
        if quota.startswith("internal_"):
            access_class = {
                "internal_admins": "admin",
                "internal_responsibles": "responsible",
                "internal_workers": "worker",
            }[quota]
            entitlement_service.require_internal_member_capacity(
                db, company_id=company.id, access_class=access_class
            )
        else:
            guard = {
                "departments": entitlement_service.require_department_capacity,
                "teams": entitlement_service.require_team_capacity,
                "accountant_portals": entitlement_service.require_accountant_portal_capacity,
                "partner_portals": entitlement_service.require_partner_portal_capacity,
            }[quota]
            guard(db, company_id=company.id)

    for index in range(max(0, limit - 1)):
        add(index)
    if limit:
        check()
        last = add(limit)
    with pytest.raises(HTTPException) as error:
        check()
    assert error.value.status_code == 409
    assert error.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
    if limit:
        if quota in {"departments", "teams"}:
            last.is_active = False
        else:
            last.status = "revoked" if quota.endswith("portals") else "suspended"
        db.flush()
        check()


@pytest.mark.parametrize("plan", CONTRACTS)
def test_storage_exact_boundary_single_file_excess_and_aggregate_excess(db, plan):
    company = contract_company(db, plan)
    limit = CONTRACTS[plan][-1]

    def reserve(requested, used):
        return entitlement_service.require_byte_quota(
            db,
            company_id=company.id,
            code="limits.location_document_storage_bytes",
            requested_bytes=requested,
            current_usage=lambda: used,
            resource_label="documentos",
        )

    assert reserve(1, limit - 1) == limit
    for requested, used, status in [(limit + 1, 0, 413), (1, limit, 409)]:
        with pytest.raises(HTTPException) as error:
            reserve(requested, used)
        assert error.value.status_code == status
        assert (
            error.value.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
        )
