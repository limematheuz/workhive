"""separate external portal grants from internal memberships

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
"""

from alembic import op
import sqlalchemy as sa


revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_access_grants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("access_type", sa.String(length=30), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "granted_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "revoked_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
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
        sa.CheckConstraint(
            "access_type IN ('accountant', 'client', 'partner')",
            name="ck_external_access_grant_type",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'revoked')",
            name="ck_external_access_grant_status",
        ),
        sa.CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_external_access_grant_revocation_date",
        ),
        sa.UniqueConstraint(
            "company_id",
            "user_id",
            "access_type",
            name="uq_external_access_grant_company_user_type",
        ),
    )
    op.create_index(
        "ix_external_access_grants_company_id",
        "external_access_grants",
        ["company_id"],
    )
    op.create_index(
        "ix_external_access_grants_user_id",
        "external_access_grants",
        ["user_id"],
    )
    op.create_index(
        "ix_external_access_grants_access_type",
        "external_access_grants",
        ["access_type"],
    )
    op.create_index(
        "ix_external_access_grants_status",
        "external_access_grants",
        ["status"],
    )
    op.create_index(
        "ix_external_access_grants_expires_at",
        "external_access_grants",
        ["expires_at"],
    )
    op.create_index(
        "ix_external_access_grants_granted_by_user_id",
        "external_access_grants",
        ["granted_by_user_id"],
    )
    op.create_index(
        "ix_external_access_grants_revoked_by_user_id",
        "external_access_grants",
        ["revoked_by_user_id"],
    )

    # Legacy accountant records were incorrectly represented as internal
    # ``responsible`` memberships. Backfill a tenant-bound external grant
    # before retiring that legacy role, then retain the old membership only as
    # inactive historical evidence.
    op.execute(
        """
        INSERT INTO external_access_grants (
            company_id, user_id, access_type, status, created_at, updated_at
        )
        SELECT users.company_id, users.id, 'accountant', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM users
        JOIN roles ON roles.id = users.role_id
        WHERE roles.name = 'accountant'
          AND users.company_id IS NOT NULL
        ON CONFLICT (company_id, user_id, access_type) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE membership_permission_profile_assignments
        SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP
        WHERE company_membership_id IN (
            SELECT company_memberships.id
            FROM company_memberships
            JOIN users ON users.id = company_memberships.user_id
            JOIN roles ON roles.id = users.role_id
            WHERE roles.name = 'accountant'
        )
        """
    )
    op.execute(
        """
        UPDATE department_memberships
        SET is_active = FALSE, is_primary = FALSE, is_lead = FALSE
        WHERE company_membership_id IN (
            SELECT company_memberships.id
            FROM company_memberships
            JOIN users ON users.id = company_memberships.user_id
            JOIN roles ON roles.id = users.role_id
            WHERE roles.name = 'accountant'
        )
        """
    )
    op.execute(
        """
        UPDATE team_memberships
        SET is_active = FALSE
        WHERE company_membership_id IN (
            SELECT company_memberships.id
            FROM company_memberships
            JOIN users ON users.id = company_memberships.user_id
            JOIN roles ON roles.id = users.role_id
            WHERE roles.name = 'accountant'
        )
        """
    )
    op.execute(
        """
        UPDATE company_memberships
        SET status = 'archived', ended_at = CURRENT_TIMESTAMP
        WHERE id IN (
            SELECT company_memberships.id
            FROM company_memberships
            JOIN users ON users.id = company_memberships.user_id
            JOIN roles ON roles.id = users.role_id
            WHERE roles.name = 'accountant'
              AND company_memberships.status <> 'archived'
        )
        """
    )

    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        VALUES ('external_portal', 'External portal user; access comes from company grants', TRUE)
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description, is_active = TRUE
        """
    )
    op.execute(
        """
        UPDATE users
        SET role_id = (SELECT id FROM roles WHERE name = 'external_portal')
        WHERE role_id = (SELECT id FROM roles WHERE name = 'accountant')
        """
    )
    op.execute(
        """
        UPDATE user_invitations
        SET role_id = (SELECT id FROM roles WHERE name = 'external_portal')
        WHERE role_id = (SELECT id FROM roles WHERE name = 'accountant')
        """
    )
    op.execute("DELETE FROM roles WHERE name = 'accountant'")


def downgrade() -> None:
    # Downgrades are exercised against PostgreSQL in CI. Restore the legacy
    # technical role so an older application revision can still resolve those
    # users, but do not recreate internal memberships, teams or profiles.
    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        VALUES ('accountant', 'Legacy accountant role', TRUE)
        ON CONFLICT (name) DO UPDATE
        SET is_active = TRUE
        """
    )
    op.execute(
        """
        UPDATE user_invitations
        SET role_id = (SELECT id FROM roles WHERE name = 'accountant')
        WHERE role_id = (SELECT id FROM roles WHERE name = 'external_portal')
        """
    )
    op.execute(
        """
        UPDATE users
        SET role_id = (SELECT id FROM roles WHERE name = 'accountant')
        WHERE role_id = (SELECT id FROM roles WHERE name = 'external_portal')
        """
    )
    op.execute("DELETE FROM roles WHERE name = 'external_portal'")
    op.drop_table("external_access_grants")
