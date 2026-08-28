"""add enterprise access foundation

Revision ID: j9k0l1m2n3o4
Revises: h8i9j0k1l2m3
"""

from alembic import op
import sqlalchemy as sa


revision = "j9k0l1m2n3o4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("access_class", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "access_class IN ('admin', 'responsible', 'worker')",
            name="ck_company_membership_access_class",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'suspended', 'archived')",
            name="ck_company_membership_status",
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_company_membership_dates",
        ),
        sa.UniqueConstraint("user_id", "company_id", name="uq_company_membership_user_company"),
        sa.UniqueConstraint("id", "company_id", name="uq_company_membership_id_company"),
    )
    op.create_index("ix_company_memberships_user_id", "company_memberships", ["user_id"])
    op.create_index("ix_company_memberships_company_id", "company_memberships", ["company_id"])
    op.create_index(
        "ix_company_memberships_access_class", "company_memberships", ["access_class"]
    )
    op.create_index("ix_company_memberships_status", "company_memberships", ["status"])

    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parent_department_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "parent_department_id IS NULL OR parent_department_id <> id",
            name="ck_department_not_own_parent",
        ),
        sa.UniqueConstraint("id", "company_id", name="uq_department_id_company"),
        sa.UniqueConstraint("company_id", "code", name="uq_department_company_code"),
        sa.ForeignKeyConstraint(
            ["parent_department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            name="fk_department_parent_same_company",
        ),
    )
    op.create_index("ix_departments_company_id", "departments", ["company_id"])
    op.create_index("ix_departments_parent_department_id", "departments", ["parent_department_id"])
    op.create_index("ix_departments_is_active", "departments", ["is_active"])

    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("id", "company_id", name="uq_team_id_company"),
        sa.UniqueConstraint("company_id", "code", name="uq_team_company_code"),
        sa.ForeignKeyConstraint(
            ["department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            name="fk_team_department_same_company",
        ),
    )
    op.create_index("ix_teams_company_id", "teams", ["company_id"])
    op.create_index("ix_teams_department_id", "teams", ["department_id"])
    op.create_index("ix_teams_is_active", "teams", ["is_active"])

    op.create_table(
        "department_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("company_membership_id", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_lead", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "department_id", "company_membership_id", name="uq_department_membership"
        ),
        sa.ForeignKeyConstraint(
            ["department_id", "company_id"],
            ["departments.id", "departments.company_id"],
            ondelete="CASCADE",
            name="fk_department_membership_department_company",
        ),
        sa.ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_department_membership_member_company",
        ),
    )
    op.create_index("ix_department_memberships_company_id", "department_memberships", ["company_id"])
    op.create_index(
        "ix_department_memberships_department_id", "department_memberships", ["department_id"]
    )
    op.create_index(
        "ix_department_memberships_company_membership_id",
        "department_memberships",
        ["company_membership_id"],
    )
    op.create_index(
        "ix_department_memberships_is_active", "department_memberships", ["is_active"]
    )

    op.create_table(
        "team_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("company_membership_id", sa.Integer(), nullable=False),
        sa.Column("is_lead", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("team_id", "company_membership_id", name="uq_team_membership"),
        sa.ForeignKeyConstraint(
            ["team_id", "company_id"],
            ["teams.id", "teams.company_id"],
            ondelete="CASCADE",
            name="fk_team_membership_team_company",
        ),
        sa.ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_team_membership_member_company",
        ),
    )
    op.create_index("ix_team_memberships_company_id", "team_memberships", ["company_id"])
    op.create_index("ix_team_memberships_team_id", "team_memberships", ["team_id"])
    op.create_index(
        "ix_team_memberships_company_membership_id",
        "team_memberships",
        ["company_membership_id"],
    )
    op.create_index("ix_team_memberships_is_active", "team_memberships", ["is_active"])

    op.create_table(
        "permission_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_permission_definitions_code", "permission_definitions", ["code"], unique=True
    )
    op.create_index(
        "ix_permission_definitions_category", "permission_definitions", ["category"]
    )
    op.create_index(
        "ix_permission_definitions_is_active", "permission_definitions", ["is_active"]
    )

    op.create_table(
        "permission_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("id", "company_id", name="uq_permission_profile_id_company"),
        sa.UniqueConstraint("company_id", "name", name="uq_permission_profile_company_name"),
    )
    op.create_index("ix_permission_profiles_company_id", "permission_profiles", ["company_id"])
    op.create_index("ix_permission_profiles_is_active", "permission_profiles", ["is_active"])

    op.create_table(
        "permission_profile_permissions",
        sa.Column(
            "permission_profile_id",
            sa.Integer(),
            sa.ForeignKey("permission_profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "permission_definition_id",
            sa.Integer(),
            sa.ForeignKey("permission_definitions.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "membership_permission_profile_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("company_membership_id", sa.Integer(), nullable=False),
        sa.Column("permission_profile_id", sa.Integer(), nullable=False),
        sa.Column(
            "assigned_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "company_membership_id",
            "permission_profile_id",
            name="uq_membership_permission_profile_assignment",
        ),
        sa.UniqueConstraint(
            "id", "company_id", name="uq_membership_profile_assignment_id_company"
        ),
        sa.ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_membership_profile_assignment_member_company",
        ),
        sa.ForeignKeyConstraint(
            ["permission_profile_id", "company_id"],
            ["permission_profiles.id", "permission_profiles.company_id"],
            ondelete="CASCADE",
            name="fk_membership_profile_assignment_profile_company",
        ),
    )
    op.create_index(
        "ix_mppa_company",
        "membership_permission_profile_assignments",
        ["company_id"],
    )
    op.create_index(
        "ix_mppa_membership",
        "membership_permission_profile_assignments",
        ["company_membership_id"],
    )
    op.create_index(
        "ix_mppa_profile",
        "membership_permission_profile_assignments",
        ["permission_profile_id"],
    )
    op.create_index(
        "ix_mppa_assigned_by",
        "membership_permission_profile_assignments",
        ["assigned_by_user_id"],
    )
    op.create_index(
        "ix_mppa_active",
        "membership_permission_profile_assignments",
        ["is_active"],
    )

    op.create_table(
        "membership_permission_profile_scopes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("profile_assignment_id", sa.Integer(), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=False),
        sa.Column("scope_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "scope_type IN ('company', 'department', 'team', 'location')",
            name="ck_membership_profile_scope_type",
        ),
        sa.CheckConstraint("scope_id > 0", name="ck_membership_profile_scope_id"),
        sa.UniqueConstraint(
            "profile_assignment_id",
            "scope_type",
            "scope_id",
            name="uq_membership_profile_scope",
        ),
        sa.ForeignKeyConstraint(
            ["profile_assignment_id", "company_id"],
            [
                "membership_permission_profile_assignments.id",
                "membership_permission_profile_assignments.company_id",
            ],
            ondelete="CASCADE",
            name="fk_membership_profile_scope_assignment_company",
        ),
    )
    op.create_index(
        "ix_mpps_company",
        "membership_permission_profile_scopes",
        ["company_id"],
    )
    op.create_index(
        "ix_mpps_assignment",
        "membership_permission_profile_scopes",
        ["profile_assignment_id"],
    )
    op.create_index(
        "ix_mpps_type",
        "membership_permission_profile_scopes",
        ["scope_type"],
    )
    op.create_index(
        "ix_mpps_target",
        "membership_permission_profile_scopes",
        ["scope_id"],
    )

    op.execute(
        """
        INSERT INTO permission_definitions (code, category, description, is_active)
        VALUES
            ('access.members.read', 'access', 'View company members', TRUE),
            ('access.members.manage', 'access', 'Invite, update, suspend, and reactivate company members', TRUE),
            ('access.profiles.read', 'access', 'View permission profiles', TRUE),
            ('access.profiles.manage', 'access', 'Create and update permission profiles', TRUE),
            ('access.scopes.manage', 'access', 'Assign the scope of a permission profile', TRUE),
            ('company.settings.manage', 'company', 'Manage company settings', TRUE),
            ('organization.departments.read', 'organization', 'View departments', TRUE),
            ('organization.departments.manage', 'organization', 'Create and update departments', TRUE),
            ('organization.teams.read', 'organization', 'View teams', TRUE),
            ('organization.teams.manage', 'organization', 'Create and update teams', TRUE)
        ON CONFLICT (code) DO UPDATE
        SET category = EXCLUDED.category,
            description = EXCLUDED.description,
            is_active = TRUE
        """
    )

    op.execute(
        """
        INSERT INTO company_memberships (
            user_id,
            company_id,
            access_class,
            status,
            started_at,
            created_at,
            updated_at
        )
        SELECT
            users.id,
            users.company_id,
            CASE roles.name
                WHEN 'admin' THEN 'admin'
                WHEN 'manager' THEN 'responsible'
                WHEN 'accountant' THEN 'responsible'
                ELSE 'worker'
            END,
            CASE WHEN users.is_active THEN 'active' ELSE 'suspended' END,
            COALESCE(users.created_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM users
        JOIN roles ON roles.id = users.role_id
        WHERE users.company_id IS NOT NULL
          AND roles.name <> 'superadmin'
        ON CONFLICT (user_id, company_id) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO permission_profiles (
            company_id, name, description, is_system, is_active
        )
        SELECT DISTINCT
            users.company_id,
            'Administrador de empresa',
            'Configuración completa de la empresa',
            TRUE,
            TRUE
        FROM users
        JOIN roles ON roles.id = users.role_id
        WHERE users.company_id IS NOT NULL
          AND roles.name = 'admin'
        ON CONFLICT (company_id, name) DO UPDATE
        SET description = EXCLUDED.description,
            is_system = TRUE,
            is_active = TRUE
        """
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions (
            permission_profile_id, permission_definition_id
        )
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        CROSS JOIN permission_definitions AS definitions
        WHERE profiles.name = 'Administrador de empresa'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO membership_permission_profile_assignments (
            company_id,
            company_membership_id,
            permission_profile_id,
            assigned_by_user_id,
            is_active,
            assigned_at
        )
        SELECT
            memberships.company_id,
            memberships.id,
            profiles.id,
            users.id,
            TRUE,
            CURRENT_TIMESTAMP
        FROM company_memberships AS memberships
        JOIN users ON users.id = memberships.user_id
        JOIN roles ON roles.id = users.role_id
        JOIN permission_profiles AS profiles
          ON profiles.company_id = memberships.company_id
         AND profiles.name = 'Administrador de empresa'
         AND profiles.is_system = TRUE
        WHERE roles.name = 'admin'
        ON CONFLICT (company_membership_id, permission_profile_id) DO UPDATE
        SET is_active = TRUE,
            revoked_at = NULL
        """
    )
    op.execute(
        """
        INSERT INTO membership_permission_profile_scopes (
            company_id, profile_assignment_id, scope_type, scope_id
        )
        SELECT assignments.company_id, assignments.id, 'company', assignments.company_id
        FROM membership_permission_profile_assignments AS assignments
        JOIN permission_profiles AS profiles
          ON profiles.id = assignments.permission_profile_id
        WHERE profiles.name = 'Administrador de empresa'
          AND profiles.is_system = TRUE
          AND assignments.is_active = TRUE
        ON CONFLICT (profile_assignment_id, scope_type, scope_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_mpps_target",
        table_name="membership_permission_profile_scopes",
    )
    op.drop_index(
        "ix_mpps_type",
        table_name="membership_permission_profile_scopes",
    )
    op.drop_index(
        "ix_mpps_assignment",
        table_name="membership_permission_profile_scopes",
    )
    op.drop_index(
        "ix_mpps_company",
        table_name="membership_permission_profile_scopes",
    )
    op.drop_table("membership_permission_profile_scopes")

    op.drop_index(
        "ix_mppa_active",
        table_name="membership_permission_profile_assignments",
    )
    op.drop_index(
        "ix_mppa_assigned_by",
        table_name="membership_permission_profile_assignments",
    )
    op.drop_index(
        "ix_mppa_profile",
        table_name="membership_permission_profile_assignments",
    )
    op.drop_index(
        "ix_mppa_membership",
        table_name="membership_permission_profile_assignments",
    )
    op.drop_index(
        "ix_mppa_company",
        table_name="membership_permission_profile_assignments",
    )
    op.drop_table("membership_permission_profile_assignments")

    op.drop_table("permission_profile_permissions")

    op.drop_index("ix_permission_profiles_is_active", table_name="permission_profiles")
    op.drop_index("ix_permission_profiles_company_id", table_name="permission_profiles")
    op.drop_table("permission_profiles")

    op.drop_index(
        "ix_permission_definitions_is_active", table_name="permission_definitions"
    )
    op.drop_index(
        "ix_permission_definitions_category", table_name="permission_definitions"
    )
    op.drop_index("ix_permission_definitions_code", table_name="permission_definitions")
    op.drop_table("permission_definitions")

    op.drop_index("ix_team_memberships_is_active", table_name="team_memberships")
    op.drop_index(
        "ix_team_memberships_company_membership_id", table_name="team_memberships"
    )
    op.drop_index("ix_team_memberships_team_id", table_name="team_memberships")
    op.drop_index("ix_team_memberships_company_id", table_name="team_memberships")
    op.drop_table("team_memberships")

    op.drop_index(
        "ix_department_memberships_is_active", table_name="department_memberships"
    )
    op.drop_index(
        "ix_department_memberships_company_membership_id",
        table_name="department_memberships",
    )
    op.drop_index(
        "ix_department_memberships_department_id", table_name="department_memberships"
    )
    op.drop_index(
        "ix_department_memberships_company_id", table_name="department_memberships"
    )
    op.drop_table("department_memberships")

    op.drop_index("ix_teams_is_active", table_name="teams")
    op.drop_index("ix_teams_department_id", table_name="teams")
    op.drop_index("ix_teams_company_id", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_departments_is_active", table_name="departments")
    op.drop_index("ix_departments_parent_department_id", table_name="departments")
    op.drop_index("ix_departments_company_id", table_name="departments")
    op.drop_table("departments")

    op.drop_index("ix_company_memberships_status", table_name="company_memberships")
    op.drop_index("ix_company_memberships_access_class", table_name="company_memberships")
    op.drop_index("ix_company_memberships_company_id", table_name="company_memberships")
    op.drop_index("ix_company_memberships_user_id", table_name="company_memberships")
    op.drop_table("company_memberships")
