from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class PermissionDefinition(Base):
    """Platform-maintained permission catalogue.

    Companies combine these stable capabilities into their own profiles.  A
    company never creates a global role or a new authorization code directly.
    """

    __tablename__ = "permission_definitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(120), nullable=False, unique=True, index=True)
    category = Column(String(80), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    profile_permissions = relationship(
        "PermissionProfilePermission", back_populates="permission_definition"
    )


class PermissionProfile(Base):
    __tablename__ = "permission_profiles"
    __table_args__ = (
        UniqueConstraint("id", "company_id", name="uq_permission_profile_id_company"),
        UniqueConstraint("company_id", "name", name="uq_permission_profile_company_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    company = relationship("Company", back_populates="permission_profiles")
    permissions = relationship(
        "PermissionProfilePermission", back_populates="permission_profile", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "MembershipPermissionProfileAssignment",
        back_populates="permission_profile",
        viewonly=True,
    )


class PermissionProfilePermission(Base):
    __tablename__ = "permission_profile_permissions"

    permission_profile_id = Column(
        Integer,
        ForeignKey("permission_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_definition_id = Column(
        Integer,
        ForeignKey("permission_definitions.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    permission_profile = relationship("PermissionProfile", back_populates="permissions")
    permission_definition = relationship("PermissionDefinition", back_populates="profile_permissions")


class MembershipPermissionProfileAssignment(Base):
    __tablename__ = "membership_permission_profile_assignments"
    __table_args__ = (
        UniqueConstraint(
            "company_membership_id",
            "permission_profile_id",
            name="uq_membership_permission_profile_assignment",
        ),
        UniqueConstraint(
            "id", "company_id", name="uq_membership_profile_assignment_id_company"
        ),
        ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_membership_profile_assignment_member_company",
        ),
        ForeignKeyConstraint(
            ["permission_profile_id", "company_id"],
            ["permission_profiles.id", "permission_profiles.company_id"],
            ondelete="CASCADE",
            name="fk_membership_profile_assignment_profile_company",
        ),
        Index("ix_mppa_company", "company_id"),
        Index("ix_mppa_membership", "company_membership_id"),
        Index("ix_mppa_profile", "permission_profile_id"),
        Index("ix_mppa_assigned_by", "assigned_by_user_id"),
        Index("ix_mppa_active", "is_active"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=False)
    company_membership_id = Column(Integer, nullable=False)
    permission_profile_id = Column(Integer, nullable=False)
    assigned_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    company_membership = relationship(
        "CompanyMembership", back_populates="profile_assignments", viewonly=True
    )
    permission_profile = relationship(
        "PermissionProfile", back_populates="assignments", viewonly=True
    )
    assigned_by = relationship("User", foreign_keys=[assigned_by_user_id])
    scopes = relationship(
        "MembershipPermissionProfileScope",
        back_populates="profile_assignment",
        cascade="all, delete-orphan",
    )


class MembershipPermissionProfileScope(Base):
    """The boundary attached to one profile assignment.

    ``scope_id`` always holds the target identifier.  For a company-wide scope
    it is the company identifier; for department, team, and location scopes it
    is the corresponding resource identifier.  The authorization service added
    in the next slice validates that the target is reachable by this company.
    """

    __tablename__ = "membership_permission_profile_scopes"
    __table_args__ = (
        CheckConstraint(
            "scope_type IN ('company', 'department', 'team', 'location')",
            name="ck_membership_profile_scope_type",
        ),
        CheckConstraint("scope_id > 0", name="ck_membership_profile_scope_id"),
        UniqueConstraint(
            "profile_assignment_id",
            "scope_type",
            "scope_id",
            name="uq_membership_profile_scope",
        ),
        ForeignKeyConstraint(
            ["profile_assignment_id", "company_id"],
            [
                "membership_permission_profile_assignments.id",
                "membership_permission_profile_assignments.company_id",
            ],
            ondelete="CASCADE",
            name="fk_membership_profile_scope_assignment_company",
        ),
        Index("ix_mpps_company", "company_id"),
        Index("ix_mpps_assignment", "profile_assignment_id"),
        Index("ix_mpps_type", "scope_type"),
        Index("ix_mpps_target", "scope_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=False)
    profile_assignment_id = Column(Integer, nullable=False)
    scope_type = Column(String(30), nullable=False)
    scope_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    profile_assignment = relationship(
        "MembershipPermissionProfileAssignment", back_populates="scopes"
    )
