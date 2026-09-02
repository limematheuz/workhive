"""add client and commercial permission profiles

Revision ID: c6d7e8f9a0b1
Revises: s8t9u0v1w2x3
"""

from alembic import op


revision = "c6d7e8f9a0b1"
down_revision = "s8t9u0v1w2x3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO permission_definitions (code, category, description, is_active)
        VALUES
            ('clients.read', 'clients', 'View company clients and contacts', TRUE),
            ('clients.manage', 'clients', 'Create, update, and email company clients', TRUE),
            ('commercial.follow_ups.read', 'commercial', 'View commercial follow-ups and their activity', TRUE),
            ('commercial.follow_ups.manage', 'commercial', 'Create and update commercial follow-ups and their activity', TRUE)
        ON CONFLICT (code) DO UPDATE
        SET category = EXCLUDED.category,
            description = EXCLUDED.description,
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
        JOIN permission_definitions AS definitions
          ON definitions.code IN (
            'clients.read',
            'clients.manage',
            'commercial.follow_ups.read',
            'commercial.follow_ups.manage'
          )
        WHERE profiles.name = 'Administrador de empresa'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permission_profiles (
            company_id, name, description, is_system, is_active
        )
        SELECT companies.id,
               'Comercial',
               'Gestiona clientes y seguimiento comercial sin acceso financiero',
               TRUE,
               TRUE
        FROM companies
        ON CONFLICT (company_id, name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions (
            permission_profile_id, permission_definition_id
        )
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN (
            'clients.read',
            'clients.manage',
            'commercial.follow_ups.read',
            'commercial.follow_ups.manage'
          )
        WHERE profiles.name = 'Comercial'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permission_profiles (
            company_id, name, description, is_system, is_active
        )
        SELECT companies.id,
               'Consulta de clientes',
               'Consulta clientes y seguimiento comercial sin modificarlos',
               TRUE,
               TRUE
        FROM companies
        ON CONFLICT (company_id, name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions (
            permission_profile_id, permission_definition_id
        )
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('clients.read', 'commercial.follow_ups.read')
        WHERE profiles.name = 'Consulta de clientes'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )


def downgrade() -> None:
    # Existing profile assignments may reference these definitions. Do not
    # remove permission data automatically during a downgrade.
    pass
