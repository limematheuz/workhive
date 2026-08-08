import type { Company } from "@/services/company.service";

export function getCompanyContactEmail(company: Company): string | null {
    const contactEmail = company.contact_email?.trim();
    return contactEmail || null;
}

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
    const base = "border text-[9px] font-semibold uppercase tracking-wide";
    if (!isCompanyAccessEnabled(company)) {
        return `${base} bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-soft)]`;
    }
    if (company.subscription_plan === "trial" || company.subscription_status === "trialing") {
        return `${base} border-accent/20 bg-accent/10 text-accent`;
    }
    if (company.subscription_plan === "pro") {
        return `${base} border-accent/25 bg-accent/10 text-accent`;
    }
    return `${base} border-accent/25 bg-accent/10 text-accent`;
}

export function formatDateForInput(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}
