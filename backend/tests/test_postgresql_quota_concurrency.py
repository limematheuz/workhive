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
from app.models.external_access_grant import ExternalAccessGrant
from app.models.role import Role
from app.models.user import User
from app.services import entitlement_service


pytestmark = pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL concurrency contract runs in CI",
)

CONCURRENT_CLAIMS = 5


def _session_factory():
    engine = create_engine(
        to_sync_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"])
    )
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def _create_company(session, *, suffix: str, label: str) -> Company:
    company = Company(
        name=f"{label} {suffix}",
        tax_id=f"QC-{suffix}",
        address="Concurrent test address",
        phone="600000099",
        email=f"quota-{suffix}@example.test",
        subscription_plan="basic",
        subscription_status="active",
    )
    session.add(company)
    session.flush()
    return company


def _create_users(
    session,
    *,
    company_id: int,
    role_id: int,
    suffix: str,
    label: str,
) -> list[User]:
    users = [
        User(
            email=f"{label}-{position}-{suffix}@example.test",
            hashed_password="not-used-in-this-test",
            full_name=f"{label.title()} {position}",
            role_id=role_id,
            company_id=company_id,
            is_active=True,
        )
        for position in range(1, CONCURRENT_CLAIMS + 1)
    ]
    session.add_all(users)
    session.flush()
    return users


def _run_concurrent_claims(identifiers: list[int], claim) -> list[str]:
    barrier = Barrier(len(identifiers))

    def run(identifier: int) -> str:
        barrier.wait(timeout=5)
        return claim(identifier)

    with ThreadPoolExecutor(max_workers=len(identifiers)) as executor:
        return list(executor.map(run, identifiers))


def _quota_outcome(session, claim) -> str:
    try:
        claim()
        session.commit()
        return "claimed"
    except HTTPException as error:
        session.rollback()
        assert error.status_code == 409
        assert error.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
        return "quota_reached"
    finally:
        session.close()


def _cleanup_company(
    session_factory,
    *,
    company_id: int | None,
    user_ids: list[int],
) -> None:
    cleanup = session_factory()
    try:
        if company_id is None:
            return
        cleanup.query(ExternalAccessGrant).filter(
            ExternalAccessGrant.company_id == company_id
        ).delete(synchronize_session=False)
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


def test_postgresql_company_lock_allows_only_one_simultaneous_seat_claim():
    """A company-row lock must serialize simultaneous seat claims.

    SQLite ignores ``FOR UPDATE`` semantics, so this regression runs against
    the isolated PostgreSQL service configured in CI. Five transactions begin
    together at a Basic plan's one-administrator limit; exactly one may create
    the membership.
    """

    engine, session_factory = _session_factory()
    suffix = uuid4().hex[:12]
    company_id: int | None = None
    user_ids: list[int] = []
    try:
        setup = session_factory()
        try:
            admin_role = setup.query(Role).filter(Role.name == "admin").one()
            company = _create_company(setup, suffix=suffix, label="Seat quota")
            company_id = company.id
            users = _create_users(
                setup,
                company_id=company.id,
                role_id=admin_role.id,
                suffix=suffix,
                label="seat",
            )
            setup.commit()
            user_ids = [user.id for user in users]
        finally:
            setup.close()

        assert company_id is not None

        def claim_administrator_seat(user_id: int) -> str:
            session = session_factory()

            def claim() -> None:
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

            return _quota_outcome(session, claim)

        outcomes = _run_concurrent_claims(user_ids, claim_administrator_seat)

        assert outcomes.count("claimed") == 1
        assert outcomes.count("quota_reached") == CONCURRENT_CLAIMS - 1
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
        _cleanup_company(
            session_factory,
            company_id=company_id,
            user_ids=user_ids,
        )
        engine.dispose()


def test_postgresql_company_lock_serializes_concurrent_promotions():
    """Promotions must not overrun the same administrator quota."""

    engine, session_factory = _session_factory()
    suffix = uuid4().hex[:12]
    company_id: int | None = None
    user_ids: list[int] = []
    membership_ids: list[int] = []
    try:
        setup = session_factory()
        try:
            viewer_role = setup.query(Role).filter(Role.name == "viewer").one()
            company = _create_company(setup, suffix=suffix, label="Promotion quota")
            company_id = company.id
            users = _create_users(
                setup,
                company_id=company.id,
                role_id=viewer_role.id,
                suffix=suffix,
                label="promotion",
            )
            memberships = [
                CompanyMembership(
                    company_id=company.id,
                    user_id=user.id,
                    access_class="worker",
                    status="active",
                )
                for user in users
            ]
            setup.add_all(memberships)
            setup.commit()
            user_ids = [user.id for user in users]
            membership_ids = [membership.id for membership in memberships]
        finally:
            setup.close()

        assert company_id is not None

        def promote(membership_id: int) -> str:
            session = session_factory()

            def claim() -> None:
                entitlement_service.require_internal_member_capacity(
                    session,
                    company_id=company_id,
                    access_class="admin",
                    exclude_membership_id=membership_id,
                )
                membership = session.get(CompanyMembership, membership_id)
                assert membership is not None
                membership.access_class = "admin"
                session.add(membership)

            return _quota_outcome(session, claim)

        outcomes = _run_concurrent_claims(membership_ids, promote)

        assert outcomes.count("claimed") == 1
        assert outcomes.count("quota_reached") == CONCURRENT_CLAIMS - 1
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
            assert (
                verification.query(CompanyMembership)
                .filter(
                    CompanyMembership.company_id == company_id,
                    CompanyMembership.access_class == "worker",
                    CompanyMembership.status == "active",
                )
                .count()
                == CONCURRENT_CLAIMS - 1
            )
        finally:
            verification.close()
    finally:
        _cleanup_company(
            session_factory,
            company_id=company_id,
            user_ids=user_ids,
        )
        engine.dispose()


def test_postgresql_company_lock_serializes_concurrent_accountant_grants():
    """External accountant grants have an independent but equally safe quota."""

    engine, session_factory = _session_factory()
    suffix = uuid4().hex[:12]
    company_id: int | None = None
    user_ids: list[int] = []
    try:
        setup = session_factory()
        try:
            external_portal_role = (
                setup.query(Role).filter(Role.name == "external_portal").one()
            )
            company = _create_company(setup, suffix=suffix, label="Portal quota")
            company_id = company.id
            users = _create_users(
                setup,
                company_id=company.id,
                role_id=external_portal_role.id,
                suffix=suffix,
                label="portal",
            )
            setup.commit()
            user_ids = [user.id for user in users]
        finally:
            setup.close()

        assert company_id is not None

        def grant_accountant_portal(user_id: int) -> str:
            session = session_factory()

            def claim() -> None:
                entitlement_service.require_accountant_portal_capacity(
                    session,
                    company_id=company_id,
                )
                session.add(
                    ExternalAccessGrant(
                        company_id=company_id,
                        user_id=user_id,
                        access_type="accountant",
                        status="active",
                    )
                )

            return _quota_outcome(session, claim)

        outcomes = _run_concurrent_claims(user_ids, grant_accountant_portal)

        assert outcomes.count("claimed") == 1
        assert outcomes.count("quota_reached") == CONCURRENT_CLAIMS - 1
        verification = session_factory()
        try:
            assert (
                verification.query(ExternalAccessGrant)
                .filter(
                    ExternalAccessGrant.company_id == company_id,
                    ExternalAccessGrant.access_type == "accountant",
                    ExternalAccessGrant.status == "active",
                )
                .count()
                == 1
            )
            assert (
                verification.query(CompanyMembership)
                .filter(CompanyMembership.company_id == company_id)
                .count()
                == 0
            )
        finally:
            verification.close()
    finally:
        _cleanup_company(
            session_factory,
            company_id=company_id,
            user_ids=user_ids,
        )
        engine.dispose()
