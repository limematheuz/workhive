import type { Invoice } from "@/types/invoice";

export const getStatusBadgeClass = (status: Invoice["status"]) => {
    switch (status) {
        case "paid":
            return "border border-[color-mix(in_srgb,var(--color-green-500)_44%,transparent)] bg-[color-mix(in_srgb,var(--color-green-500)_16%,transparent)] text-[var(--color-green-700)]";
        case "overdue":
        case "cancelled":
            return "border border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_42%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_10%,transparent)] text-[var(--btn-cancel-hover-bg)]";
        case "issued":
            return "border border-[color-mix(in_srgb,var(--accent-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] text-accent";
        case "draft":
            return "border border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]";
        case "rectified":
            return "border border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_42%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_10%,transparent)] text-[var(--btn-cancel-hover-bg)]";
        default:
            return "border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]";
    }
};

export const getInvoiceStatusText = (status: Invoice["status"], labels: {
    status_draft: string;
    status_issued: string;
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
