"""Create deterministic data for the local Playwright E2E suite.

This script intentionally accepts only a separately named SQLite database. It
never reads the normal development database target, so rebuilding the E2E
fixture cannot erase developer or production data.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.client import Client
from app.models.company import Company
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.location import Location
from app.models.quote import Quote
from app.models.quote_item import QuoteItem
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.user import User
from app.services.invoice_fiscal import party_snapshots

E2E_PASSWORD = "e2e-password"


def require_isolated_database() -> None:
    e2e_database_url = os.environ.get("E2E_DATABASE_URL", "")
    if not e2e_database_url.startswith("sqlite:") or not e2e_database_url.endswith(".e2e.db"):
        raise RuntimeError("E2E_DATABASE_URL must be an isolated SQLite file ending in .e2e.db")
    if settings.DATABASE_URL != e2e_database_url:
        raise RuntimeError("DATABASE_URL must exactly match E2E_DATABASE_URL")


def seed() -> None:
    require_isolated_database()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        superadmin_role = Role(name="superadmin", description="E2E platform administrator")
        admin_role = Role(name="admin", description="E2E company administrator")
        db.add_all([superadmin_role, admin_role])
        db.flush()

        company = Company(
            name="E2E Services",
            tax_id="E2E-SERVICES",
            address="Calle de pruebas 1",
            postal_code="28001",
            city="Madrid",
            phone="600000001",
            email="admin@e2e.example",
            subscription_plan="pro",
            subscription_status="active",
            onboarding_completed=True,
        )
        db.add(company)
        db.flush()

        superadmin = User(
            email="superadmin@e2e.example",
            hashed_password=get_password_hash(E2E_PASSWORD),
            full_name="E2E Superadmin",
            role_id=superadmin_role.id,
            company_id=None,
            is_active=True,
            email_verified_at=now,
        )
        admin = User(
            email="admin@e2e.example",
            hashed_password=get_password_hash(E2E_PASSWORD),
            full_name="E2E Admin",
            role_id=admin_role.id,
            company_id=company.id,
            is_active=True,
            email_verified_at=now,
        )
        client = Client(
            name="E2E Client",
            client_type="company",
            legal_number="E2E-CLIENT-001",
            address="Calle del cliente 1",
            city="Madrid",
            postal_code="28002",
            country="España",
            company_id=company.id,
        )
        db.add_all([superadmin, admin, client])
        db.flush()

        location = Location(
            name="E2E Apartment",
            address="Avenida E2E 1",
            city="Madrid",
            postal_code="28003",
            owner_company_id=company.id,
            managing_company_id=company.id,
            client_id=client.id,
        )
        db.add(location)
        db.flush()

        reservation = Reservation(
            check_in_at=now - timedelta(days=1),
            check_out_at=now + timedelta(days=2),
            guest_count=2,
            status="confirmed",
            location_id=location.id,
            owner_company_id=company.id,
            assigned_company_id=company.id,
            created_by_user_id=admin.id,
        )
        task = TaskItem(
            title="E2E Cleaning Task",
            status="accepted",
            priority="medium",
            unit="service",
            company_id=company.id,
            location_id=location.id,
            user_id=admin.id,
            price=100.0,
            quantity=1.0,
        )
        invoice = Invoice(
            invoice_number="INV-2026-0001",
            issue_date=now,
            due_date=now + timedelta(days=15),
            status="issued",
            base_amount=Decimal("100.00"),
            tax_amount=Decimal("21.00"),
            total_amount=Decimal("121.00"),
            company_id=company.id,
            client_id=client.id,
        )
        quote = Quote(
            quote_number="QUO-E2E-QUO-001",
            title="E2E Commercial Quote",
            status="draft",
            base_amount=100.0,
            tax_amount=21.0,
            total_amount=121.0,
            company_id=company.id,
            client_id=client.id,
        )
        db.add_all([reservation, task, invoice, quote])
        db.flush()
        invoice.issuer_snapshot, invoice.recipient_snapshot = party_snapshots(
            company, client, invoice
        )
        db.add_all(
            [
                InvoiceItem(
                    description="E2E cleaning service",
                    quantity=Decimal("1"),
                    unit_price=Decimal("100"),
                    tax_rate=Decimal("0.21"),
                    subtotal=Decimal("100"),
                    total=Decimal("121"),
                    invoice_id=invoice.id,
                    task_item_id=task.id,
                ),
                QuoteItem(
                    description="E2E cleaning service",
                    quantity=1.0,
                    unit_price=100.0,
                    subtotal=100.0,
                    quote_id=quote.id,
                ),
            ]
        )
        db.commit()


if __name__ == "__main__":
    seed()
