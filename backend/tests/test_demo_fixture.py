import pytest

from app.models.company_membership import Department, Team
from app.models.location import Location
from app.models.permission_profile import (
    MembershipPermissionProfileScope,
    PermissionProfile,
)
from app.models.subscription_entitlement import CompanySubscription
from app.models.user import User
from scripts.demo_fixture import seed_demo_enterprise
from scripts.seed_demo import DEMO_STORAGE_ROOT, require_demo_database
from credentials import TEST_SECRET


def test_demo_fixture_creates_a_fictional_enterprise_company_with_scoped_profiles(db):
    company = seed_demo_enterprise(db, password=TEST_SECRET)

    subscription = (
        db.query(CompanySubscription)
        .filter(CompanySubscription.company_id == company.id)
        .one()
    )
    assert company.subscription_plan == "mega"
    assert company.subscription_status == "active"
    assert subscription.plan.code == "mega"
    assert subscription.commercial_amount_cents == 24900
    assert subscription.commercial_billing_interval == "monthly"
    assert db.query(Department).filter(Department.company_id == company.id).count() == 3
    assert db.query(Team).filter(Team.company_id == company.id).count() == 3
    assert (
        db.query(PermissionProfile)
        .filter(PermissionProfile.company_id == company.id)
        .count()
        >= 5
    )
    users = db.query(User).filter(User.company_id == company.id).all()
    assert len(users) == 5
    assert all(user.email.endswith(".invalid") for user in users)
    assert all(user.full_name for user in users)
    scopes = (
        db.query(MembershipPermissionProfileScope)
        .filter(MembershipPermissionProfileScope.company_id == company.id)
        .all()
    )
    assert {scope.scope_type for scope in scopes} >= {"company", "department", "team"}
    locations = db.query(Location).filter(Location.owner_company_id == company.id).all()
    assert len(locations) == 2
    assert all(location.name.startswith("Sede ficticia") for location in locations)


def test_demo_seed_rejects_a_database_outside_the_repository_demo_storage(monkeypatch):
    outside_database = DEMO_STORAGE_ROOT.parent / "outside.demo.db"
    database_url = f"sqlite:///{outside_database}"
    monkeypatch.setenv("DEMO_DATABASE_URL", database_url)
    monkeypatch.setattr("scripts.seed_demo.settings.DATABASE_URL", database_url)

    with pytest.raises(RuntimeError, match="backend/storage/demo"):
        require_demo_database()


def test_demo_seed_requires_the_runtime_database_url_to_match(monkeypatch):
    database_path = DEMO_STORAGE_ROOT / "workhive.demo.db"
    demo_database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DEMO_DATABASE_URL", demo_database_url)
    monkeypatch.setattr(
        "scripts.seed_demo.settings.DATABASE_URL",
        "sqlite:////different-workhive.db",
    )

    with pytest.raises(RuntimeError, match="must exactly match"):
        require_demo_database()


def test_demo_seed_is_disabled_when_the_runtime_is_production(monkeypatch):
    database_path = DEMO_STORAGE_ROOT / "workhive.demo.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DEMO_DATABASE_URL", database_url)
    monkeypatch.setattr("scripts.seed_demo.settings.DATABASE_URL", database_url)
    monkeypatch.setattr("scripts.seed_demo.settings.ENVIRONMENT", "production")

    with pytest.raises(RuntimeError, match="disabled in production"):
        require_demo_database()
