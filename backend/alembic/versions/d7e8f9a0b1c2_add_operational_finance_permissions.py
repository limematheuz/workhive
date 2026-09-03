"""add operational and finance permission profiles

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
"""

from alembic import op


revision = "d7e8f9a0b1c2"
down_revision = "c6d7e8f9a0b1"
branch_labels = None
depends_on = None


def _replace_system_profile_permissions(profile_name: str, codes: tuple[str, ...]) -> None:
    quoted_codes = ", ".join(f"'{code}'" for code in codes)
    op.execute(
        f"""
        DELETE FROM permission_profile_permissions
        WHERE permission_profile_id IN (
            SELECT id
            FROM permission_profiles
            WHERE name = '{profile_name}'
              AND is_system = TRUE
        )
        """
    )
    op.execute(
        f"""
        INSERT INTO permission_profile_permissions (
            permission_profile_id, permission_definition_id
        )
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ({quoted_codes})
        WHERE profiles.name = '{profile_name}'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )


def _ensure_system_profile(profile_name: str, description: str) -> None:
    op.execute(
        f"""
        INSERT INTO permission_profiles (
            company_id, name, description, is_system, is_active
        )
        SELECT companies.id,
               '{profile_name}',
               '{description}',
               TRUE,
               TRUE
        FROM companies
        WHERE NOT EXISTS (
            SELECT 1
            FROM permission_profiles AS profiles
            WHERE profiles.company_id = companies.id
              AND profiles.name = '{profile_name}'
        )
        """
    )
    op.execute(
        f"""
        UPDATE permission_profiles
        SET description = '{description}',
            is_active = TRUE
        WHERE name = '{profile_name}'
          AND is_system = TRUE
        """
    )


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO permission_definitions (code, category, description, is_active)
        VALUES
            ('locations.read', 'locations', 'View company locations', TRUE),
            ('locations.manage', 'locations', 'Create and update company locations', TRUE),
            ('work.read', 'work', 'View work orders', TRUE),
            ('work.manage', 'work', 'Create and update work orders', TRUE),
            ('time.read', 'time', 'View company time records', TRUE),
            ('time.manage', 'time', 'Start and manage permitted work time', TRUE),
            ('finance.read', 'finance', 'View quotes, invoices, expenses, and fiscal records', TRUE),
            ('finance.manage', 'finance', 'Create and update financial records', TRUE)
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
              'locations.read', 'locations.manage',
              'work.read', 'work.manage',
              'time.read', 'time.manage',
              'finance.read', 'finance.manage'
          )
        WHERE profiles.name = 'Administrador de empresa'
          AND profiles.is_system = TRUE
        ON CONFLICT (permission_profile_id, permission_definition_id) DO NOTHING
        """
    )
    _ensure_system_profile(
        "Consulta",
        "Consulta información operativa y registra su propio tiempo sin acceso comercial o financiero",
    )
    _ensure_system_profile(
        "Operaciones",
        "Gestiona ubicaciones, trabajos y tiempo sin acceso comercial o financiero",
    )
    _ensure_system_profile(
        "Finanzas",
        "Consulta presupuestos, facturas, gastos y fiscalidad sin modificarlos",
    )
    _replace_system_profile_permissions(
        "Consulta",
        ("locations.read", "work.read", "time.manage"),
    )
    _replace_system_profile_permissions(
        "Operaciones",
        (
            "organization.departments.read",
            "organization.teams.read",
            "locations.read",
            "locations.manage",
            "work.read",
            "work.manage",
            "time.read",
            "time.manage",
        ),
    )
    _replace_system_profile_permissions("Finanzas", ("finance.read",))


def downgrade() -> None:
    # Existing profiles and assignments may reference these permissions. Keep
    # authorization data intact rather than silently revoking access.
    pass
