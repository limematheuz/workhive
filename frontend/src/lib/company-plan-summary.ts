import type { Entitlement, PlanCode } from "../services/company-plan-access.service.ts";

const LIMIT_ORDER = [
    "limits.internal_admins",
    "limits.internal_responsibles",
    "limits.internal_workers",
    "limits.departments",
    "limits.teams",
    "limits.external_portals",
    "limits.accountant_portals",
    "limits.partner_portals",
    "limits.location_document_storage_bytes",
];
const NUMBER_FORMATTERS = {
    es: new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }),
    en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }),
};
const TRIAL_DATE_FORMATTERS = {
    es: new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }),
    en: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }),
};

export function canViewCompanyPlanSummary(user: {
    company_id?: number | null;
    role?: { name?: string } | null;
} | null): boolean {
    return user?.role?.name === "admin" && user.company_id != null;
}

export function displayPlanCode(code: string | undefined): PlanCode | null {
    if (code === "trial" || code === "pro") return "top";
    if (code === "free") return "basic";
    if (["basic", "medium", "top", "mega", "custom"].includes(code ?? "")) {
        return code as PlanCode;
    }
    return null;
}

export function visibleCompanyPlanEntitlements(entitlements: Entitlement[]) {
    return {
        features: entitlements.filter(
            (item) => item.group === "Funciones"
                && item.value_type === "boolean"
                && item.value === true
                && item.availability === "available",
        ),
        limits: entitlements.filter(
            (item) => item.group === "Capacidad"
                && item.value_type === "integer"
                && typeof item.value === "number"
                && item.availability === "available",
        ).sort((left, right) => {
            const leftIndex = LIMIT_ORDER.indexOf(left.code);
            const rightIndex = LIMIT_ORDER.indexOf(right.code);
            return (leftIndex < 0 ? LIMIT_ORDER.length : leftIndex)
                - (rightIndex < 0 ? LIMIT_ORDER.length : rightIndex);
        }),
    };
}

export function formatCompanyPlanLimit(code: string, value: number, locale: "es" | "en"): string {
    const number = code === "limits.location_document_storage_bytes"
        ? value / (1024 * 1024)
        : value;
    const formatted = NUMBER_FORMATTERS[locale].format(number);
    return code === "limits.location_document_storage_bytes" ? `${formatted} MB` : formatted;
}

export function formatCompanyPlanTrialEnd(value: string | null | undefined, locale: "es" | "en"): string | null {
    if (!value) return null;
    const datePart = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const date = new Date(`${datePart}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : TRIAL_DATE_FORMATTERS[locale].format(date);
}
