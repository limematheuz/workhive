from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import os
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database_url import to_sync_database_url
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.role import Role
from app.models.user import User
from app.services import entitlement_service


pytestmark = pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL concurrency contract runs in CI",
)


def test_postgresql_company_lock_allows_only_one_simultaneous_seat_claim():
    """A company-row lock must serialize simultaneous seat claims.

    SQLite ignores ``FOR UPDATE`` semantics, so this regression runs against
    the isolated PostgreSQL service configured in CI. Both transactions begin
    together at a Basic plan's one-administrator limit; exactly one may create
    the membership.
    """

    engine = create_engine(
        to_sync_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"])
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    suffix = uuid4().hex[:12]
    company_id: int | None = None
    user_ids: list[int] = []
    try:
        setup = session_factory()
        try:
            admin_role = setup.query(Role).filter(Role.name == "admin").one()
            company = Company(
                name=f"Concurrent quota {suffix}",
                tax_id=f"CQ-{suffix}",
                address="Concurrent test address",
                phone="600000099",
                email=f"concurrent-{suffix}@example.test",
                subscription_plan="basic",
                subscription_status="active",
            )
            setup.add(company)
            setup.flush()
            company_id = company.id
            users = [
                User(
                    email=f"concurrent-{position}-{suffix}@example.test",
                    hashed_password="not-used-in-this-test",
                    full_name=f"Concurrent administrator {position}",
                    role_id=admin_role.id,
                    company_id=company.id,
                    is_active=True,
                )
                for position in (1, 2)
            ]
            setup.add_all(users)
            setup.commit()
            user_ids = [user.id for user in users]
        finally:
            setup.close()

        barrier = Barrier(2)

        def claim_administrator_seat(user_id: int) -> str:
            session = session_factory()
            try:
                barrier.wait(timeout=5)
                entitlement_service.require_internal_member_capacity(
                    session,
                    company_id=company_id,
                    access_class="admin",
                )
                session.add(
                    CompanyMembership(
                        company_id=company_id,
                        user_id=user_id,
                        access_class="admin",
                        status="active",
                    )
                )
                session.commit()
                return "claimed"
            except HTTPException as error:
                session.rollback()
                assert error.status_code == 409
                assert error.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
                return "quota_reached"
            finally:
                session.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(claim_administrator_seat, user_ids))

        assert sorted(outcomes) == ["claimed", "quota_reached"]
        verification = session_factory()
        try:
            assert (
                verification.query(CompanyMembership)
                .filter(
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.access_class == "admin",
                    CompanyMembership.status == "active",
                )
                .count()
                == 1
            )
        finally:
            verification.close()
    finally:
        cleanup = session_factory()
        try:
            if company_id is not None:
                cleanup.query(CompanyMembership).filter(
                    CompanyMembership.company_id == company_id
                ).delete(synchronize_session=False)
                cleanup.query(User).filter(User.id.in_(user_ids)).delete(
                    synchronize_session=False
                )
                cleanup.query(Company).filter(Company.id == company_id).delete(
                    synchronize_session=False
                )
                cleanup.commit()
        finally:
            cleanup.close()
            engine.dispose()
