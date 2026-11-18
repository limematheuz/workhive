import json
from datetime import datetime, timezone

import pytest

from app.models.company_collaboration import CompanyCollaboration
from app.models.external_access_grant import ExternalAccessGrant
from app.models.location_document import LocationDocument
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.role import Role
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    EntitlementChangeAudit,
)
from app.models.user import User
from test_company_entitlement_management_api import (
    _activate_company,
    _company,
    _commercial_terms,
    _entitlement_payload,
    _platform_headers,
)
from test_entitlement_service import make_company
from tests.test_task_security_delivery import _location


@pytest.mark.parametrize(
    "resource",
    ["accountant_portals", "partner_portals", "location_document_storage_bytes"],
)
@pytest.mark.parametrize("operation", ["plan", "customization", "override"])
def test_commercial_changes_preserve_existing_portals_and_documents(
    client, db, resource, operation
):
    company = _company(db)
    headers = _platform_headers(client, db)
    _activate_company(client, company, headers)
    role_name = (
        "external_portal"
        if resource == "accountant_portals"
        else "partner_portal"
        if resource == "partner_portals"
        else "admin"
    )
    role = db.query(Role).filter_by(name=role_name).one()
    if resource == "partner_portals":
        partner = make_company(
            db, suffix="commercial-partner", plan="none", status="inactive"
        )
        collaboration = CompanyCollaboration(
            initiator_company_id=company.id,
            partner_company_id=partner.id,
            role_type="property_manager",
            status="accepted",
        )
        db.add(collaboration)
        db.flush()
    for index in range(2 if resource == "accountant_portals" else 1):
        user = User(
            email=f"resource-{index}@example.test",
            hashed_password="unused",
            role_id=role.id,
            company_id=partner.id if resource == "partner_portals" else company.id,
            is_active=True,
        )
        db.add(user)
        db.flush()
        if resource == "accountant_portals":
            row = ExternalAccessGrant(
                company_id=company.id,
                user_id=user.id,
                access_type="accountant",
                status="active",
            )
        elif resource == "partner_portals":
            row = PartnerPortalGrant(
                host_company_id=company.id,
                partner_company_id=partner.id,
                collaboration_id=collaboration.id,
                user_id=user.id,
                status="active",
            )
        else:
            location = _location(db, company)
            row = LocationDocument(
                company_id=company.id,
                location_id=location.id,
                name="retained.pdf",
                storage_key="qa/retained.pdf",
                content_type="application/pdf",
                size_bytes=2097152,
                sha256="0" * 64,
                created_by_user_id=user.id,
            )
        db.add(row)
    db.commit()
    path = f"/api/v1/companies/{company.id}/plan-access"
    before = client.get(path, headers=headers)
    assert before.status_code == 200
    audit_count = (
        db.query(EntitlementChangeAudit).filter_by(company_id=company.id).count()
    )
    code = "limits." + resource
    if operation == "plan":
        response = client.put(
            path,
            headers=headers,
            json={
                "plan_code": "basic",
                "status": "active",
                "commercial_terms": _commercial_terms(),
                "reason": "Capacity regression",
            },
        )
    elif operation == "customization":
        response = client.put(
            path + "/customization",
            headers=headers,
            json={
                "reason": "Capacity regression",
                "entitlements": _entitlement_payload(
                    before.json()["base_entitlements"], changes={code: 0}
                ),
            },
        )
    else:
        response = client.post(
            path + "/overrides",
            headers=headers,
            json={"code": code, "integer_value": 0, "reason": "Capacity regression"},
        )
    assert response.status_code == 409, response.text
    assert (
        response.headers["X-WorkHive-Error-Code"]
        == "entitlement.capacity_below_current_usage"
    )
    db.expire_all()
    assert db.get(type(company), company.id).subscription_plan == "top"
    assert (
        db.query(CompanyEntitlementOverride).filter_by(company_id=company.id).count()
        == 0
    )
    assert (
        db.query(EntitlementChangeAudit).filter_by(company_id=company.id).count()
        == audit_count
    )
    if resource == "location_document_storage_bytes":
        db.query(LocationDocument).filter_by(company_id=company.id).update(
            {"archived_at": datetime.now(timezone.utc)}
        )
    elif resource == "accountant_portals":
        db.query(ExternalAccessGrant).filter_by(company_id=company.id).update(
            {"status": "revoked"}
        )
    else:
        db.query(PartnerPortalGrant).filter_by(host_company_id=company.id).update(
            {"status": "revoked"}
        )
    db.commit()
    retry = client.request(
        response.request.method,
        str(response.request.url),
        headers=headers,
        json=json.loads(response.request.content),
    )
    assert retry.status_code == (201 if operation == "override" else 200), retry.text
