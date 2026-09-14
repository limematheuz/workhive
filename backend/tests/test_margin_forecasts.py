from datetime import datetime, timezone
from decimal import Decimal

from app.models.company import Company
from app.models.inventory import InventoryMaterial, InventoryMovement, InventoryWarehouse
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession

from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _authenticated_company(client, *, email: str, name: str, tax_id: str):
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": name,
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registered.status_code == 201, registered.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        json={
            "name": name,
            "tax_id": tax_id,
            "address": "Calle Margen 1",
            "phone": "+34600111444",
            "email": email,
        },
        headers=headers,
    )
    assert company.status_code == 201, company.text
    return headers


def _set_profitability_plan(db, email: str) -> Company:
    company = db.query(Company).filter(Company.email == email).one()
    company.subscription_plan = "pro"
    company.subscription_status = "active"
    db.commit()
    return company


def _create_contract_and_order(client, headers):
    customer = client.post(
        "/api/v1/clients/",
        json={
            "name": "Cliente de margen",
            "address": "Calle Cliente 2",
            "city": "Girona",
            "postal_code": "17001",
            "country": "España",
            "email": "margen.cliente@workhive-margin.com",
        },
        headers=headers,
    )
    assert customer.status_code == 201, customer.text
    location = client.post(
        "/api/v1/locations/",
        json={
            "name": "Sede de margen",
            "address": "Avenida Margen 2",
            "city": "Girona",
            "postal_code": "17002",
            "location_type": "office",
            "client_id": customer.json()["id"],
            "spaces": [],
        },
        headers=headers,
    )
    assert location.status_code == 201, location.text
    quote = client.post(
        "/api/v1/quotes/",
        json={
            "client_id": customer.json()["id"],
            "title": "Contrato de margen",
            "items": [{"description": "Servicio mensual", "quantity": 1, "unit_price": 330}],
        },
        headers=headers,
    )
    assert quote.status_code == 201, quote.text
    quote_id = quote.json()["id"]
    assert client.patch(
        f"/api/v1/quotes/{quote_id}", json={"status": "sent"}, headers=headers
    ).status_code == 200
    accepted = client.post(
        f"/api/v1/quotes/{quote_id}/accept",
        json={"register_client": False},
        headers=headers,
    )
    assert accepted.status_code == 200, accepted.text
    contract = client.get("/api/v1/service-contracts/", headers=headers).json()[0]
    attached = client.post(
        f"/api/v1/service-contracts/{contract['id']}/locations",
        json={"location_ids": [location.json()["id"]]},
        headers=headers,
    )
    assert attached.status_code == 200, attached.text
    activated = client.post(
        f"/api/v1/service-contracts/{contract['id']}/activate", headers=headers
    )
    assert activated.status_code == 200, activated.text
    order = client.post(
        "/api/v1/work-orders/",
        json={
            "title": "Orden de margen",
            "location_id": location.json()["id"],
            "service_contract_id": contract["id"],
            "status": "active",
            "order_type": "one_off",
            "scheduled_start_at": "2026-08-01T09:00:00Z",
        },
        headers=headers,
    )
    assert order.status_code == 201, order.text
    return contract, location.json(), order.json()


def _seed_traced_actuals(db, company: Company, email: str, location_id: int, order_id: int):
    user = db.query(User).filter(User.email == email).one()
    task = TaskItem(
        company_id=company.id,
        location_id=location_id,
        work_order_id=order_id,
        title="Ejecución facturable",
        unit="service",
    )
    material = InventoryMaterial(
        company_id=company.id,
        sku="MARGEN-001",
        name="Material de margen",
        unit="unit",
        reorder_point=0,
    )
    warehouse = InventoryWarehouse(company_id=company.id, name="Almacén margen")
    db.add_all([task, material, warehouse])
    db.flush()
    db.add(
        WorkSession(
            user_id=user.id,
            location_id=location_id,
            task_item_id=task.id,
            start_time=datetime(2026, 8, 1, 9, tzinfo=timezone.utc),
            end_time=datetime(2026, 8, 1, 10, tzinfo=timezone.utc),
            labor_cost_company_id=company.id,
            labor_cost_rate_snapshot=Decimal("20.00"),
            labor_cost_amount_snapshot=Decimal("20.00"),
        )
    )
    db.add(
        InventoryMovement(
            company_id=company.id,
            material_id=material.id,
            warehouse_id=warehouse.id,
            work_order_id=order_id,
            movement_type="issue",
            quantity=Decimal("3"),
            unit_cost=Decimal("5.00"),
        )
    )
    reversed_issue = InventoryMovement(
        company_id=company.id,
        material_id=material.id,
        warehouse_id=warehouse.id,
        work_order_id=order_id,
        movement_type="issue",
        quantity=Decimal("1"),
        unit_cost=Decimal("99.00"),
    )
    db.add(reversed_issue)
    db.flush()
    db.add(
        InventoryMovement(
            company_id=company.id,
            material_id=material.id,
            warehouse_id=warehouse.id,
            work_order_id=order_id,
            movement_type="adjustment_in",
            quantity=Decimal("1"),
            unit_cost=Decimal("99.00"),
            reversal_of_movement_id=reversed_issue.id,
        )
    )
    invoice = Invoice(
        company_id=company.id,
        client_id=company.clients[0].id,
        invoice_number="MARGEN-001",
        issue_date=datetime(2026, 8, 1, tzinfo=timezone.utc),
        status="issued",
        base_amount=Decimal("150.00"),
        tax_amount=Decimal("31.50"),
        total_amount=Decimal("181.50"),
    )
    db.add(invoice)
    db.flush()
    db.add(
        InvoiceItem(
            invoice_id=invoice.id,
            task_item_id=task.id,
            description="Servicio ejecutado",
            quantity=Decimal("1"),
            unit_price=Decimal("150"),
            subtotal=Decimal("150"),
            total=Decimal("181.50"),
        )
    )
    db.commit()


def test_explicit_contract_and_order_cost_budgets_compare_only_traced_actuals(client, db):
    email = "margin-owner@workhive-margin.com"
    headers = _authenticated_company(
        client,
        email=email,
        name="Margen Owner",
        tax_id="B10000071",
    )
    company = _set_profitability_plan(db, email)
    contract, location, order = _create_contract_and_order(client, headers)
    _seed_traced_actuals(db, company, email, location["id"], order["id"])

    before_budget = client.get(
        f"/api/v1/margin-forecasts/contracts/{contract['id']}", headers=headers
    )
    assert before_budget.status_code == 200, before_budget.text
    assert before_budget.json() == {
        "scope_type": "contract",
        "scope_id": contract["id"],
        "scope_name": "Contrato de margen",
        "budget": None,
        "planned_revenue_base_amount": "330.00",
        "planned_direct_cost_base_amount": None,
        "planned_margin_base_amount": None,
        "actual_revenue_base_amount": "150.00",
        "actual_labor_cost_base_amount": "20.00",
        "actual_material_cost_base_amount": "15.00",
        "actual_direct_cost_base_amount": "35.00",
        "actual_margin_base_amount": "115.00",
        "direct_cost_variance_base_amount": None,
    }

    saved_contract = client.put(
        f"/api/v1/margin-forecasts/contracts/{contract['id']}",
        json={"planned_direct_cost_amount": "80.00", "notes": "Personal y material"},
        headers=headers,
    )
    assert saved_contract.status_code == 200, saved_contract.text
    assert saved_contract.json()["planned_margin_base_amount"] == "250.00"
    assert saved_contract.json()["direct_cost_variance_base_amount"] == "-45.00"

    updated_contract = client.put(
        f"/api/v1/margin-forecasts/contracts/{contract['id']}",
        json={"planned_direct_cost_amount": "90.00"},
        headers=headers,
    )
    assert updated_contract.status_code == 200, updated_contract.text
    assert updated_contract.json()["budget"]["planned_direct_cost_amount"] == "90.00"

    order_forecast = client.put(
        f"/api/v1/margin-forecasts/work-orders/{order['id']}",
        json={"planned_direct_cost_amount": "60.00"},
        headers=headers,
    )
    assert order_forecast.status_code == 200, order_forecast.text
    assert order_forecast.json()["planned_revenue_base_amount"] is None
    assert order_forecast.json()["planned_margin_base_amount"] is None
    assert order_forecast.json()["actual_direct_cost_base_amount"] == "35.00"
    assert order_forecast.json()["direct_cost_variance_base_amount"] == "-25.00"


def test_margin_forecast_is_tenant_scoped_and_rejects_invalid_budgets(client, db):
    owner_email = "margin-scope-owner@workhive-margin.com"
    owner_headers = _authenticated_company(
        client,
        email=owner_email,
        name="Margen Scope Owner",
        tax_id="B10000072",
    )
    _set_profitability_plan(db, owner_email)
    contract, _, _ = _create_contract_and_order(client, owner_headers)
    outsider_email = "margin-scope-outsider@workhive-margin.com"
    outsider_headers = _authenticated_company(
        client,
        email=outsider_email,
        name="Margen Scope Ajeno",
        tax_id="B10000073",
    )
    _set_profitability_plan(db, outsider_email)

    hidden = client.get(
        f"/api/v1/margin-forecasts/contracts/{contract['id']}", headers=outsider_headers
    )
    assert hidden.status_code == 404
    invalid = client.put(
        f"/api/v1/margin-forecasts/contracts/{contract['id']}",
        json={"planned_direct_cost_amount": "-0.01"},
        headers=owner_headers,
    )
    assert invalid.status_code == 422
