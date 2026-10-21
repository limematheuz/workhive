import type { Invoice } from "@/types/invoice";

const ALLOWED_TRANSITIONS: Record<Invoice["status"], string[]> = {
    draft: ["issued", "cancelled"],
    issued: ["overdue"],
    partially_paid: [],
    paid: [],
    cancelled: [],
    overdue: [],
    rectified: [],
};

export const getInvoiceNextStates = (invoice: Pick<Invoice, "status" | "is_rectification">): string[] =>
    invoice.is_rectification ? [] : ALLOWED_TRANSITIONS[invoice.status];

export const getStatusBadgeClass = (status: Invoice["status"]) => {
    switch (status) {
        case "paid":
            // Blue — cobrada
            return "border border-[color-mix(in_srgb,var(--accent-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent";
        case "partially_paid":
            return "border border-[color-mix(in_srgb,var(--alert-warning-border)_54%,transparent)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]";
        case "draft":
            // Orange — borrador
            return "border border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]";
        case "issued":
        case "overdue":
            // Red — emitida / no pagada / vencida
            return "border border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_42%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_10%,transparent)] text-[var(--btn-cancel-hover-bg)]";
        case "cancelled":
        case "rectified":
            return "border border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_42%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_10%,transparent)] text-[var(--btn-cancel-hover-bg)]";
        default:
            return "border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]";
    }
};

export const getInvoiceStatusText = (status: Invoice["status"], labels: {
    status_draft: string;
    status_issued: string;
    status_partially_paid: string;
    status_paid: string;
    status_overdue: string;
    status_cancelled: string;
    status_rectified: string;
}) => {
    switch (status) {
        case "draft":
            return labels.status_draft;
        case "issued":
            return labels.status_issued;
        case "paid":
            return labels.status_paid;
        case "partially_paid":
            return labels.status_partially_paid;
        case "overdue":
            return labels.status_overdue;
        case "cancelled":
            return labels.status_cancelled;
        case "rectified":
            return labels.status_rectified;
        default:
            return status;
    }
};
