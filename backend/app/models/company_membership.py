from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class CompanyMembership(Base):
    """An internal person's durable link to one company.

    ``access_class`` is deliberately separate from permissions.  It represents
    the commercial/internal class (administrator, responsible, or worker),
    while profiles will define what the person may actually do.
    """

    __tablename__ = "company_memberships"
    __table_args__ = (
        CheckConstraint(
            "access_class IN ('admin', 'responsible', 'worker')",
            name="ck_company_membership_access_class",
        ),
        CheckConstraint(
            "status IN ('active', 'suspended', 'archived')",
            name="ck_company_membership_status",
        ),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_company_membership_dates",
        ),
        UniqueConstraint(
            "user_id", "company_id", name="uq_company_membership_user_company"
        ),
        UniqueConstraint("id", "company_id", name="uq_company_membership_id_company"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    access_class = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    # An explicit empty permission selection must not restore a legacy role.
    permissions_configured = Column(Boolean, nullable=False, default=False, server_default=false())
    started_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="company_memberships")
    company = relationship("Company", back_populates="memberships")
    department_memberships = relationship(
        "DepartmentMembership",
        back_populates="company_membership",
        viewonly=True,
    )
    team_memberships = relationship(
        "TeamMembership",
        back_populates="company_membership",
        viewonly=True,
    )
    profile_assignments = relationship(
        "MembershipPermissionProfileAssignment",
        back_populates="company_membership",
        viewonly=True,
    )
    client_account_assignments = relationship(
        "ClientAccountAssignment",
        back_populates="company_membership",
        viewonly=True,
    )


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        CheckConstraint(
            "parent_department_id IS NULL OR parent_department_id <> id",
            name="ck_department_not_own_parent",
        ),
        UniqueConstraint("id", "company_id", name="uq_department_id_company"),
        UniqueConstraint(
            "company_id",
            "normalized_name",
            name="uq_department_company_normalized_name",
        ),
        UniqueConstraint("company_id", "code", name="uq_department_company_code"),
        ForeignKeyConstraint(
            ["parent_department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            name="fk_department_parent_same_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_department_id = Column(Integer, nullable=True, index=True)
    name = Column(String(120), nullable=False)
    normalized_name = Column(String(120), nullable=False)
    code = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company", back_populates="departments")
    parent = relationship(
        "Department",
        remote_side=[id, company_id],
        back_populates="children",
        foreign_keys=[parent_department_id, company_id],
        viewonly=True,
    )
    children = relationship("Department", back_populates="parent", viewonly=True)
    teams = relationship("Team", back_populates="department", viewonly=True)
    memberships = relationship(
        "DepartmentMembership", back_populates="department", viewonly=True
    )


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("id", "company_id", name="uq_team_id_company"),
        UniqueConstraint("company_id", "code", name="uq_team_company_code"),
        ForeignKeyConstraint(
            ["department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            name="fk_team_department_same_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id = Column(Integer, nullable=True, index=True)
    name = Column(String(120), nullable=False)
    code = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company", back_populates="teams")
    department = relationship(
        "Department",
        back_populates="teams",
        foreign_keys=[department_id, company_id],
        viewonly=True,
    )
    memberships = relationship("TeamMembership", back_populates="team", viewonly=True)


class DepartmentMembership(Base):
    __tablename__ = "department_memberships"
    __table_args__ = (
        UniqueConstraint(
            "department_id", "company_membership_id", name="uq_department_membership"
        ),
        ForeignKeyConstraint(
            ["department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            ondelete="CASCADE",
            name="fk_department_membership_department_company",
        ),
        ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_department_membership_member_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=False, index=True)
    department_id = Column(Integer, nullable=False, index=True)
    company_membership_id = Column(Integer, nullable=False, index=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    is_lead = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    department = relationship("Department", back_populates="memberships", viewonly=True)
    company_membership = relationship(
        "CompanyMembership", back_populates="department_memberships", viewonly=True
    )


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    __table_args__ = (
        UniqueConstraint("team_id", "company_membership_id", name="uq_team_membership"),
        ForeignKeyConstraint(
            ["team_id", "company_id"],
            ["teams.id", "teams.company_id"],
            ondelete="CASCADE",
            name="fk_team_membership_team_company",
        ),
        ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_team_membership_member_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=False, index=True)
    team_id = Column(Integer, nullable=False, index=True)
    company_membership_id = Column(Integer, nullable=False, index=True)
    is_lead = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    team = relationship("Team", back_populates="memberships", viewonly=True)
    company_membership = relationship(
        "CompanyMembership", back_populates="team_memberships", viewonly=True
    )
