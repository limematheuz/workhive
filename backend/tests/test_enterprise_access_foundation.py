import pytest
from sqlalchemy.exc import IntegrityError

from app.models.company import Company
from app.models.company_membership import (
    CompanyMembership,
    Department,
    DepartmentMembership,
    Team,
)
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionProfile,
)
from app.models.user import User


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Enterprise {suffix}",
        tax_id=f"ENT-{suffix}",
        address="Calle de prueba 1",
        phone="600000000",
        email=f"{suffix}@enterprise.test",
    )
    db.add(company)
    db.flush()
    return company


def _user(db, company: Company, suffix: str, role_id: int = 3) -> User:
    user = User(
        email=f"{suffix}@enterprise.test",
        hashed_password="unused",
        full_name=suffix,
        role_id=role_id,
        company_id=company.id,
    )
    db.add(user)
    db.flush()
    return user


def _enable_foreign_keys(db) -> None:
    db.connection().exec_driver_sql("PRAGMA foreign_keys = ON")


def test_company_membership_accepts_only_the_internal_access_classes(db):
    company = _company(db, "membership")
    user = _user(db, company, "member")
    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        access_class="responsible",
        status="active",
    )
    db.add(membership)
    db.commit()

    assert membership.access_class == "responsible"
    assert membership.status == "active"

    invalid_membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        access_class="external_portal",
        status="active",
    )
    db.add(invalid_membership)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_department_and_team_relationships_reject_another_company(db):
    _enable_foreign_keys(db)
    first = _company(db, "first")
    second = _company(db, "second")
    first_user = _user(db, first, "first-user")
    second_user = _user(db, second, "second-user")
    first_membership = CompanyMembership(
        user_id=first_user.id,
        company_id=first.id,
        access_class="worker",
        status="active",
    )
    second_membership = CompanyMembership(
        user_id=second_user.id,
        company_id=second.id,
        access_class="worker",
        status="active",
    )
    first_department = Department(
        company_id=first.id,
        name="Operations",
        normalized_name="operations",
    )
    second_department = Department(
        company_id=second.id,
        name="Operations",
        normalized_name="operations",
    )
    db.add_all(
        [first_membership, second_membership, first_department, second_department]
    )
    db.commit()

    invalid_department_membership = DepartmentMembership(
        company_id=first.id,
        department_id=first_department.id,
        company_membership_id=second_membership.id,
    )
    db.add(invalid_department_membership)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    invalid_team = Team(
        company_id=first.id,
        department_id=second_department.id,
        name="Foreign department team",
    )
    db.add(invalid_team)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_profile_assignment_and_scope_stay_with_the_members_company(db):
    _enable_foreign_keys(db)
    first = _company(db, "profiles-first")
    second = _company(db, "profiles-second")
    first_user = _user(db, first, "profiles-first-user")
    second_user = _user(db, second, "profiles-second-user")
    first_membership = CompanyMembership(
        user_id=first_user.id,
        company_id=first.id,
        access_class="admin",
        status="active",
    )
    second_membership = CompanyMembership(
        user_id=second_user.id,
        company_id=second.id,
        access_class="responsible",
        status="active",
    )
    first_profile = PermissionProfile(company_id=first.id, name="Operations")
    db.add_all([first_membership, second_membership, first_profile])
    db.commit()

    invalid_assignment = MembershipPermissionProfileAssignment(
        company_id=first.id,
        company_membership_id=second_membership.id,
        permission_profile_id=first_profile.id,
    )
    db.add(invalid_assignment)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    valid_assignment = MembershipPermissionProfileAssignment(
        company_id=first.id,
        company_membership_id=first_membership.id,
        permission_profile_id=first_profile.id,
        assigned_by_user_id=first_user.id,
    )
    db.add(valid_assignment)
    db.commit()

    scope = MembershipPermissionProfileScope(
        company_id=first.id,
        profile_assignment_id=valid_assignment.id,
        scope_type="company",
        scope_id=first.id,
    )
    db.add(scope)
    db.commit()

    duplicate_scope = MembershipPermissionProfileScope(
        company_id=first.id,
        profile_assignment_id=valid_assignment.id,
        scope_type="company",
        scope_id=first.id,
    )
    db.add(duplicate_scope)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
