from sqlalchemy.orm import Session

from app.models.permission_profile import (
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.repositories import organization as organization_repo


ADMIN_PROFILE_NAME = "Administrador de empresa"
COMMERCIAL_PROFILE_NAME = "Comercial"
CONSULTATION_PROFILE_NAME = "Consulta"
OPERATIONS_PROFILE_NAME = "Operaciones"
FINANCE_PROFILE_NAME = "Finanzas"


DEFAULT_PERMISSION_DEFINITIONS: tuple[tuple[str, str, str], ...] = (
    ("access.members.read", "access", "View company members"),
    (
        "access.members.manage",
        "access",
        "Invite, update, suspend, and reactivate company members",
    ),
    ("access.profiles.read", "access", "View permission profiles"),
    ("access.profiles.manage", "access", "Create and update permission profiles"),
    ("access.scopes.manage", "access", "Assign the scope of a permission profile"),
    ("company.settings.manage", "company", "Manage company settings"),
    ("organization.departments.read", "organization", "View departments"),
    (
        "organization.departments.manage",
        "organization",
        "Create and update departments",
    ),
    ("organization.teams.read", "organization", "View teams"),
    ("organization.teams.manage", "organization", "Create and update teams"),
    ("clients.read", "clients", "View company clients and contacts"),
    ("clients.manage", "clients", "Create, update, and email company clients"),
    ("locations.read", "locations", "View company locations"),
    ("locations.manage", "locations", "Create and update company locations"),
    ("work.read", "work", "View work orders"),
    ("work.manage", "work", "Create and update work orders"),
    ("time.read", "time", "View company time records"),
    ("time.manage", "time", "Start and manage permitted work time"),
    ("time.approve", "time", "Review requested work-time corrections"),
    ("finance.read", "finance", "View quotes, invoices, expenses, and fiscal records"),
    ("finance.manage", "finance", "Create and update financial records"),
    ("labor_costs.read", "finance", "View confidential internal labour costs"),
    ("labor_costs.manage", "finance", "Set confidential internal labour costs"),
    (
        "commercial.follow_ups.read",
        "commercial",
        "View commercial follow-ups and their activity",
    ),
    (
        "commercial.follow_ups.manage",
        "commercial",
        "Create and update commercial follow-ups and their activity",
    ),
)

COMMERCIAL_PERMISSION_CODES = frozenset(
    {
        "clients.read",
        "clients.manage",
        "commercial.follow_ups.read",
        "commercial.follow_ups.manage",
    }
)

CONSULTATION_PERMISSION_CODES = frozenset(
    {"locations.read", "work.read", "time.manage"}
)

OPERATIONS_PERMISSION_CODES = frozenset(
    {
        "organization.departments.read",
        "organization.teams.read",
        "locations.read",
        "locations.manage",
        "work.read",
        "work.manage",
        "time.read",
        "time.manage",
        "time.approve",
    }
)

FINANCE_PERMISSION_CODES = frozenset({"finance.read"})


def ensure_permission_definitions(db: Session) -> None:
    existing_codes = {code for (code,) in db.query(PermissionDefinition.code).all()}
    for code, category, description in DEFAULT_PERMISSION_DEFINITIONS:
        if code not in existing_codes:
            db.add(
                PermissionDefinition(
                    code=code,
                    category=category,
                    description=description,
                    is_active=True,
                )
            )
    db.flush()


def _ensure_system_profile(
    db: Session,
    *,
    company_id: int,
    name: str,
    description: str,
    permission_codes: set[str] | frozenset[str] | None,
) -> PermissionProfile:
    profile = (
        db.query(PermissionProfile)
        .filter(
            PermissionProfile.company_id == company_id,
            PermissionProfile.name == name,
        )
        .first()
    )
    if not profile:
        profile = PermissionProfile(
            company_id=company_id,
            name=name,
            description=description,
            is_system=True,
            is_active=True,
        )
        db.add(profile)
        db.flush()
    elif not profile.is_system:
        # Do not convert or modify a customer-managed profile during bootstrap.
        return profile
    elif name == ADMIN_PROFILE_NAME:
        profile.description = description
        profile.is_system = True
        profile.is_active = True
        db.add(profile)

    else:
        # Base profiles are safe starting points, not immutable policy. Once a
        # company changes Comercial, Operaciones, Finanzas or Consulta, that
        # choice must not be overwritten whenever a member signs in.
        return profile

    definitions = organization_repo.list_permission_definitions(db)
    allowed_codes = (
        {definition.code for definition in definitions}
        if permission_codes is None
        else set(permission_codes)
    )
    existing_codes = {
        code
        for (code,) in (
            db.query(PermissionDefinition.code)
            .join(
                PermissionProfilePermission,
                PermissionProfilePermission.permission_definition_id
                == PermissionDefinition.id,
            )
            .filter(
                PermissionProfilePermission.permission_profile_id == profile.id,
            )
            .all()
        )
    }
    for definition in definitions:
        if definition.code in allowed_codes and definition.code not in existing_codes:
            db.add(
                PermissionProfilePermission(
                    permission_profile_id=profile.id,
                    permission_definition_id=definition.id,
                )
            )
        elif definition.code not in allowed_codes and definition.code in existing_codes:
            (
                db.query(PermissionProfilePermission)
                .filter(
                    PermissionProfilePermission.permission_profile_id == profile.id,
                    PermissionProfilePermission.permission_definition_id == definition.id,
                )
                .delete(synchronize_session=False)
            )
    db.flush()
    return profile


def ensure_company_permission_profiles(db: Session, company_id: int) -> PermissionProfile:
    ensure_permission_definitions(db)
    administrator_profile = _ensure_system_profile(
        db,
        company_id=company_id,
        name=ADMIN_PROFILE_NAME,
        description="Configuración completa de la empresa",
        permission_codes=None,
    )
    if not administrator_profile.is_system:
        raise RuntimeError(
            "A custom permission profile conflicts with the reserved administrator profile name"
        )
    base_profiles = (
        (
            COMMERCIAL_PROFILE_NAME,
            "Gestiona clientes y seguimiento comercial sin acceso financiero",
            COMMERCIAL_PERMISSION_CODES,
        ),
        (
            CONSULTATION_PROFILE_NAME,
            "Consulta información operativa y registra su propio tiempo sin acceso comercial o financiero",
            CONSULTATION_PERMISSION_CODES,
        ),
        (
            OPERATIONS_PROFILE_NAME,
            "Gestiona ubicaciones, trabajos y tiempo sin acceso comercial o financiero",
            OPERATIONS_PERMISSION_CODES,
        ),
        (
            FINANCE_PROFILE_NAME,
            "Consulta presupuestos, facturas, gastos y fiscalidad sin modificarlos",
            FINANCE_PERMISSION_CODES,
        ),
    )
    for name, description, permission_codes in base_profiles:
        profile = _ensure_system_profile(
            db,
            company_id=company_id,
            name=name,
            description=description,
            permission_codes=permission_codes,
        )
        if not profile.is_system:
            raise RuntimeError(
                f"A custom permission profile conflicts with the reserved {profile.name} profile name"
            )
    return administrator_profile


def ensure_company_administrator_profile(
    db: Session,
    company_id: int,
) -> PermissionProfile:
    return ensure_company_permission_profiles(db, company_id)
