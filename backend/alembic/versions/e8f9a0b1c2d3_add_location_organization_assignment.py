"""assign owned locations to organization units

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
"""

from alembic import op
import sqlalchemy as sa


revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO permission_profile_permissions (
            permission_profile_id, permission_definition_id
        )
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN (
              'organization.departments.read',
              'organization.teams.read'
          )
        WHERE profiles.name = 'Operaciones'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )
    op.add_column("locations", sa.Column("department_id", sa.Integer(), nullable=True))
    op.add_column("locations", sa.Column("team_id", sa.Integer(), nullable=True))
    op.create_index("ix_locations_department_id", "locations", ["department_id"])
    op.create_index("ix_locations_team_id", "locations", ["team_id"])
    op.create_foreign_key(
        "fk_location_department_owner_company",
        "locations",
        "departments",
        ["department_id", "owner_company_id"],
        ["id", "company_id"],
    )
    op.create_foreign_key(
        "fk_location_team_owner_company",
        "locations",
        "teams",
        ["team_id", "owner_company_id"],
        ["id", "company_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_location_team_owner_company",
        "locations",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_location_department_owner_company",
        "locations",
        type_="foreignkey",
    )
    op.drop_index("ix_locations_team_id", table_name="locations")
    op.drop_index("ix_locations_department_id", table_name="locations")
    op.drop_column("locations", "team_id")
    op.drop_column("locations", "department_id")
