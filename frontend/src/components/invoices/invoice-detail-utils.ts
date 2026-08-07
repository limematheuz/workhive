import type { Dictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";

export function parseInvoiceDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (year && month && day) {
        return new Date(year, month - 1, day);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getInvoiceServiceMonthName(issueDate: string, locale: "en" | "es") {
    const date = parseInvoiceDate(issueDate);
    if (!date) return "";
    const serviceDate = new Date(date);
    serviceDate.setMonth(serviceDate.getMonth() - 1);
    return serviceDate.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", { month: "long" });
}

export function buildDefaultInvoiceEmailMessage({
    recipientName,
    issueDate,
    issuerName,
    isDraft,
    dict,
    locale,
}: {
    recipientName: string;
    issueDate: string;
    issuerName: string;
    isDraft: boolean;
    dict: Dictionary;
    locale: "en" | "es";
}) {
    const month = getInvoiceServiceMonthName(issueDate, locale);
    const serviceMonth = month ? dict.invoices.service_month_fragment.replace("{month}", month) : "";
    return [
        dict.invoices.email_default_greeting.replace("{recipient}", recipientName || dict.invoices.client.toLowerCase()),
        "",
        (isDraft ? dict.invoices.email_default_proforma_body : dict.invoices.email_default_invoice_body)
            .replace("{serviceMonth}", serviceMonth),
        "",
        dict.invoices.email_default_thanks,
        dict.invoices.email_default_regards,
        "",
        issuerName,
    ].join("\n");
}

export function getInvoiceStatusMeta(status: string, dict: Dictionary) {
    if (status === "draft") {
        return {
            label: dict.invoices.status_draft || "Borrador",
            className: "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
        };
    }
    if (status === "issued") {
        return {
            label: dict.invoices.status_issued || "Emitida",
            className: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
        };
    }
    if (status === "paid") {
        return {
            label: dict.invoices.status_paid || "Pagada",
            className: "border-[color-mix(in_srgb,var(--accent-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent",
        };
    }
    if (status === "overdue") {
        return {
            label: dict.invoices.status_overdue || "Vencida",
            className: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
        };
    }
    if (status === "cancelled") {
        return {
            label: dict.invoices.status_cancelled || "Cancelada",
            className: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
        };
    }
    return {
        label: status,
        className: "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]",
    };
}

export function statusActionMeta(state: string, dict: Dictionary) {
    const grayAction =
        "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] hover:border-[var(--border-color)] hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]";

    if (state === "issued") {
        return {
            label: dict.invoices.issue_fiscal_invoice,
            className: grayAction,
        };
    }
    if (state === "paid") {
        return {
            label: dict.invoices.status_paid,
            className: grayAction,
        };
    }
    if (state === "cancelled") {
        return {
            label: dict.invoices.status_cancelled,
            className: grayAction,
        };
    }
    if (state === "overdue") {
        return {
            label: dict.invoices.status_overdue,
            className: grayAction,
        };
    }
    return {
        label: state,
        className: grayAction,
    };
}

export function actionButtonClass(
    tone: "primary" | "secondary" | "neutral" | "danger" | "disabled" | "select" = "neutral",
) {
    return cn(
        "inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-2xl border px-3.5 text-center text-[12px] font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[8.5rem]",
        tone === "primary" && "border-[var(--border-soft)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]",
        tone === "secondary" && "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]",
        tone === "select" && "border-[var(--btn-select-border)] bg-[var(--btn-select-bg)] text-[var(--btn-select-text)] hover:bg-[var(--btn-select-hover-bg)]",
        tone === "neutral" && "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_rgba(52,74,94,0.08)] backdrop-blur-xl hover:border-[var(--border-color)] hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]",
        tone === "danger" && "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] hover:border-[var(--btn-cancel-border)] hover:bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_14%,transparent)]",
        tone === "disabled" && "cursor-not-allowed border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]",
    );
}
