import type { Company } from "@/services/company.service";

export function isCompanyAccessEnabled(company: Company): boolean {
    if (!company.is_active) return false;
    if (company.subscription_plan === "none") return false;
    if (["inactive", "canceled", "expired"].includes(company.subscription_status || "")) {
        return false;
    }
    return true;
}

export function getCompanyAccessLabel(
    company: Company,
    activeLabel: string,
    inactiveLabel: string,
): string {
    if (!company.is_active) return inactiveLabel;
    if (company.subscription_plan === "none" || company.subscription_status === "inactive") return "Sin acceso";
    if (company.subscription_status === "expired") return "Expirada";
    if (company.subscription_status === "canceled") return "Cancelada";
    if (company.subscription_plan === "trial" || company.subscription_status === "trialing") return "Prueba";
    if (company.subscription_plan === "pro") return "Pro";
    if (company.subscription_plan === "free") return "Pro";
    if (company.subscription_status === "active") return activeLabel;
    return company.subscription_status || activeLabel;
}

export function getCompanyAccessBadgeClass(company: Company): string {
    const base = "border text-[9px] font-bold uppercase";
    if (!isCompanyAccessEnabled(company)) {
        return `${base} bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-soft)]`;
    }
    if (company.subscription_plan === "trial" || company.subscription_status === "trialing") {
        return `${base} border-accent/20 bg-accent/10 text-accent`;
    }
    if (company.subscription_plan === "pro") {
        return `${base} border-violet-500/20 bg-violet-500/10 text-violet-600`;
    }
    return `${base} border-emerald-500/20 bg-emerald-500/10 text-emerald-500`;
}

export function formatDateForInput(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}
