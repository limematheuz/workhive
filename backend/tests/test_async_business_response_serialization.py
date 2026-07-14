from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_async_db
from app.core.security import create_access_token
from app.db.base import Base
from app.main import app
from app.models.client import Client
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.quote import Quote
from app.models.quote_item import QuoteItem
from app.models.role import Role
from app.models.user import User


@pytest_asyncio.fixture()
async def async_business_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with factory() as session:
        role = Role(name="admin", description="Admin")
        owner = Company(
            name="Owner Company",
            tax_id="ASYNC-BUSINESS-OWNER",
            address="Owner Street 1",
            phone="600000001",
            email="owner-company@example.com",
            subscription_plan="pro",
            subscription_status="active",
        )
        partner = Company(
            name="Partner Company",
            tax_id="ASYNC-BUSINESS-PARTNER",
            address="Partner Street 1",
            phone="600000002",
            email="partner-company@example.com",
            subscription_plan="pro",
            subscription_status="active",
        )
        session.add_all([role, owner, partner])
        await session.flush()

        user = User(
            email="async-business-admin@example.com",
            hashed_password="unused",
            full_name="Async Business Admin",
            role_id=role.id,
            company_id=owner.id,
        )
        partner_user = User(
            email="async-partner-admin@example.com",
            hashed_password="unused",
            full_name="Async Partner Admin",
            role_id=role.id,
            company_id=partner.id,
        )
        client = Client(
            name="Async Client",
            client_type="company",
            legal_number="ASYNC-CLIENT-1",
            address="Client Street 1",
            city="Madrid",
            postal_code="28001",
            country="España",
            company_id=owner.id,
        )
        collaboration = CompanyCollaboration(
            initiator_company_id=owner.id,
            partner_company_id=partner.id,
            status="accepted",
            role_type="service_provider",
        )
        session.add_all([user, partner_user, client, collaboration])
        await session.flush()

        now = datetime.now(timezone.utc)
        invoice = Invoice(
            invoice_number="INV-ASYNC-1",
            issue_date=now,
            due_date=now + timedelta(days=15),
            status="draft",
            base_amount=Decimal("100.00"),
            tax_amount=Decimal("21.00"),
            total_amount=Decimal("121.00"),
            company_id=owner.id,
            client_id=client.id,
        )
        quote = Quote(
            quote_number="QUO-ASYNC-1",
            title="Async Quote",
            status="draft",
            base_amount=100.0,
            tax_amount=21.0,
            total_amount=121.0,
            company_id=owner.id,
            client_id=client.id,
        )
        session.add_all([invoice, quote])
        await session.flush()
        session.add_all(
            [
                InvoiceItem(
                    description="Invoice line",
                    quantity=Decimal("1"),
                    unit_price=Decimal("100"),
                    tax_rate=Decimal("0.21"),
                    subtotal=Decimal("100"),
                    total=Decimal("121"),
                    invoice_id=invoice.id,
                ),
                QuoteItem(
                    description="Quote line",
                    quantity=1.0,
                    unit_price=100.0,
                    subtotal=100.0,
                    quote_id=quote.id,
                ),
            ]
        )
        await session.commit()
        seed = {
            "company_id": owner.id,
            "email": user.email,
            "partner_email": partner_user.email,
            "invoice_id": invoice.id,
            "quote_id": quote.id,
        }

    try:
        yield factory, seed
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_async_business_endpoints_serialize_nested_relations_without_500(
    async_business_factory,
):
    factory, seed = async_business_factory

    async def override_get_async_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_async_db] = override_get_async_db
    token = create_access_token({"sub": seed["email"], "ver": 0})
    headers = {"Authorization": f"Bearer {token}"}
    paths = (
        "/api/v1/companies/",
        f"/api/v1/companies/{seed['company_id']}",
        "/api/v1/collaborations/",
        "/api/v1/collaborations/service-providers",
        "/api/v1/collaborations/requests/pending",
        "/api/v1/collaborations/requests/sent",
        "/api/v1/invoices/",
        f"/api/v1/invoices/{seed['invoice_id']}",
        f"/api/v1/invoices/{seed['invoice_id']}/items",
        "/api/v1/quotes/",
        f"/api/v1/quotes/{seed['quote_id']}",
        f"/api/v1/quotes/{seed['quote_id']}/items",
    )
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        ) as client:
            responses = {
                path: await client.get(path, headers=headers) for path in paths
            }
    finally:
        app.dependency_overrides.pop(get_async_db, None)

    failures = {
        path: response.text
        for path, response in responses.items()
        if response.status_code != 200
    }
    assert failures == {}
    assert responses["/api/v1/companies/"].json()[0]["contact_email"] == seed["email"]
    assert (
        responses["/api/v1/invoices/"].json()[0]["items"][0]["description"]
        == "Invoice line"
    )
    assert (
        responses[f"/api/v1/invoices/{seed['invoice_id']}"].json()["items"][0][
            "description"
        ]
        == "Invoice line"
    )
    assert (
        responses[f"/api/v1/invoices/{seed['invoice_id']}/items"].json()[0][
            "description"
        ]
        == "Invoice line"
    )
    assert (
        responses["/api/v1/quotes/"].json()[0]["items"][0]["description"]
        == "Quote line"
    )
    assert (
        responses[f"/api/v1/quotes/{seed['quote_id']}"].json()["items"][0][
            "description"
        ]
        == "Quote line"
    )
    assert (
        responses[f"/api/v1/quotes/{seed['quote_id']}/items"].json()[0]["description"]
        == "Quote line"
    )
    assert (
        responses["/api/v1/collaborations/"].json()[0]["partner"]["contact_email"]
        == "async-partner-admin@example.com"
    )
    assert (
        responses["/api/v1/collaborations/service-providers"].json()[0]["contact_email"]
        == "async-partner-admin@example.com"
    )


@pytest.mark.asyncio
async def test_async_business_endpoints_keep_company_data_tenant_isolated(
    async_business_factory,
):
    factory, seed = async_business_factory

    async def override_get_async_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_async_db] = override_get_async_db
    token = create_access_token({"sub": seed["partner_email"], "ver": 0})
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        ) as client:
            company = await client.get(
                f"/api/v1/companies/{seed['company_id']}", headers=headers
            )
            invoices = await client.get("/api/v1/invoices/", headers=headers)
            invoice = await client.get(
                f"/api/v1/invoices/{seed['invoice_id']}", headers=headers
            )
            quotes = await client.get("/api/v1/quotes/", headers=headers)
            quote = await client.get(
                f"/api/v1/quotes/{seed['quote_id']}", headers=headers
            )
    finally:
        app.dependency_overrides.pop(get_async_db, None)

    assert company.status_code == 403
    assert invoices.status_code == 200 and invoices.json() == []
    assert invoice.status_code == 404
    assert quotes.status_code == 200 and quotes.json() == []
    assert quote.status_code == 404
