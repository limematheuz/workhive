"""Stable WorkHive plan definitions used by migrations and isolated tests."""

from typing import TypeAlias

from sqlalchemy.orm import Session

from app.models.subscription_entitlement import PlanEntitlement, PlanPrice, SubscriptionPlan
from app.repositories import subscription_entitlement as entitlement_repo
from app.services.plan_pricing_service import DEFAULT_PLAN_PRICE_VALUES


EntitlementValue: TypeAlias = bool | int

PLAN_CODES = ("basic", "medium", "top", "mega", "custom")
LEGACY_PLAN_CODES = {
    "free": "basic",
    "trial": "top",
    "business": "medium",
    "pro": "top",
    "lifetime": "top",
    "none": "basic",
}
FEATURE_CODES = (
    "features.organization",
    "features.teams",
    "features.clients",
    "features.locations",
    "features.work_orders",
    "features.time_tracking",
    "features.quotes",
    "features.invoices",
    "features.service_catalog",
    "features.recurrence",
    "features.planning",
    "features.basic_exports",
    "features.client_portal",
    "features.quality",
    "features.profitability",
    "features.inventory",
    "features.hr",
    "features.partner_portal",
    "features.accountant_portal",
    "features.integrations",
    "features.approvals",
    "features.branches",
    "features.corporate_structure",
    "features.api",
    "features.advanced_integrations",
)
QUOTA_CODES = (
    "limits.internal_admins",
    "limits.internal_responsibles",
    "limits.internal_workers",
    "limits.departments",
    "limits.teams",
    "limits.external_portals",
    "limits.accountant_portals",
)
ALL_ENTITLEMENT_CODES = frozenset((*FEATURE_CODES, *QUOTA_CODES))

_CORE_FEATURES = {
    "features.organization",
    "features.teams",
    "features.clients",
    "features.locations",
    "features.work_orders",
    "features.time_tracking",
    "features.quotes",
    "features.invoices",
}
_MEDIUM_FEATURES = _CORE_FEATURES | {
    "features.service_catalog",
    "features.recurrence",
    "features.planning",
    "features.basic_exports",
    "features.client_portal",
}
_TOP_FEATURES = _MEDIUM_FEATURES | {
    "features.quality",
    "features.profitability",
    "features.inventory",
    "features.hr",
    "features.partner_portal",
    "features.accountant_portal",
    "features.integrations",
    "features.approvals",
}
_PLAN_FEATURES = {
    "basic": _CORE_FEATURES,
    "medium": _MEDIUM_FEATURES,
    "top": _TOP_FEATURES,
    "mega": set(FEATURE_CODES),
    "custom": set(FEATURE_CODES),
}
_PLAN_LIMITS = {
    "basic": {
        "limits.internal_admins": 1,
        "limits.internal_responsibles": 2,
        "limits.internal_workers": 5,
        "limits.departments": 1,
        "limits.teams": 2,
        "limits.external_portals": 5,
        "limits.accountant_portals": 1,
    },
    "medium": {
        "limits.internal_admins": 3,
        "limits.internal_responsibles": 8,
        "limits.internal_workers": 25,
        "limits.departments": 5,
        "limits.teams": 10,
        "limits.external_portals": 25,
        "limits.accountant_portals": 2,
    },
    "top": {
        "limits.internal_admins": 10,
        "limits.internal_responsibles": 20,
        "limits.internal_workers": 100,
        "limits.departments": 25,
        "limits.teams": 50,
        "limits.external_portals": 100,
        "limits.accountant_portals": 5,
    },
    "mega": {
        "limits.internal_admins": 25,
        "limits.internal_responsibles": 75,
        "limits.internal_workers": 500,
        "limits.departments": 100,
        "limits.teams": 250,
        "limits.external_portals": 500,
        "limits.accountant_portals": 20,
    },
}
_PLAN_NAMES = {
    "basic": "Basic",
    "medium": "Medium",
    "top": "Top",
    "mega": "Enterprise",
    "custom": "Personalizado",
}

_ENTITLEMENT_LABELS = {
    "features.organization": "Organización",
    "features.teams": "Equipos",
    "features.clients": "Clientes",
    "features.locations": "Ubicaciones",
    "features.work_orders": "Órdenes de trabajo",
    "features.time_tracking": "Control horario",
    "features.quotes": "Presupuestos",
    "features.invoices": "Facturas",
    "features.service_catalog": "Catálogo de servicios",
    "features.recurrence": "Trabajo recurrente",
    "features.planning": "Planificación",
    "features.basic_exports": "Exportaciones básicas",
    "features.client_portal": "Portal de cliente",
    "features.quality": "Control de calidad",
    "features.profitability": "Rentabilidad",
    "features.inventory": "Inventario",
    "features.hr": "Recursos humanos",
    "features.partner_portal": "Portal de colaboradores",
    "features.accountant_portal": "Portal de gestoría",
    "features.integrations": "Integraciones",
    "features.approvals": "Aprobaciones",
    "features.branches": "Delegaciones",
    "features.corporate_structure": "Estructura corporativa",
    "features.api": "Acceso API",
    "features.advanced_integrations": "Integraciones avanzadas",
    "limits.internal_admins": "Administradores",
    "limits.internal_responsibles": "Responsables",
    "limits.internal_workers": "Trabajadores",
    "limits.departments": "Departamentos",
    "limits.teams": "Equipos",
    "limits.external_portals": "Usuarios de portal externo",
    "limits.accountant_portals": "Usuarios de portal de gestoría",
}


def legacy_plan_code(plan_code: str | None) -> str:
    normalized = (plan_code or "none").strip().lower()
    return (
        normalized
        if normalized in PLAN_CODES
        else LEGACY_PLAN_CODES.get(normalized, "basic")
    )


def plan_label(plan_code: str | None) -> str:
    return _PLAN_NAMES[legacy_plan_code(plan_code)]


def entitlement_presentation(code: str) -> tuple[str, str, str]:
    """Return UI-safe metadata without asking clients to parse internal codes."""
    if code not in ALL_ENTITLEMENT_CODES:
        raise ValueError(f"Unknown entitlement code: {code}")
    return (
        "Funciones" if code.startswith("features.") else "Capacidad",
        _ENTITLEMENT_LABELS[code],
        "boolean" if code.startswith("features.") else "integer",
    )


def default_plan_values(plan_code: str) -> dict[str, EntitlementValue]:
    normalized = legacy_plan_code(plan_code)
    limits = _PLAN_LIMITS.get(normalized, _PLAN_LIMITS["mega"])
    return {
        **{code: code in _PLAN_FEATURES[normalized] for code in FEATURE_CODES},
        **limits,
    }


def seed_default_plan_catalog(db: Session) -> None:
    """Seed fresh development/test databases without mutating published versions."""
    for code in PLAN_CODES:
        plan = entitlement_repo.get_plan(db, code=code)
        if plan is None:
            plan = SubscriptionPlan(
                code=code, name=_PLAN_NAMES[code], version=1, is_active=True
            )
            db.add(plan)
            db.flush()
        existing_codes = {item.code for item in plan.entitlements}
        for entitlement_code, value in default_plan_values(code).items():
            if entitlement_code in existing_codes:
                continue
            db.add(
                PlanEntitlement(
                    plan_id=plan.id,
                    code=entitlement_code,
                    value_type="boolean" if isinstance(value, bool) else "integer",
                    boolean_value=value if isinstance(value, bool) else None,
                    integer_value=value
                    if isinstance(value, int) and not isinstance(value, bool)
                    else None,
                )
            )
        if code in DEFAULT_PLAN_PRICE_VALUES and not plan.prices:
            for billing_interval, amount_cents in DEFAULT_PLAN_PRICE_VALUES[code].items():
                db.add(
                    PlanPrice(
                        plan_id=plan.id,
                        billing_interval=billing_interval,
                        amount_cents=amount_cents,
                        currency="EUR",
                        tax_behavior="exclusive",
                    )
                )
    db.flush()
