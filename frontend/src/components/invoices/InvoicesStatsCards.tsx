"use client";

import { formatCurrency } from "@/lib/format";

type InvoiceStats = {
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    openAmount: number;
    overdueAmount: number;
};

type InvoicesStatsCardsProps = {
    stats: InvoiceStats;
    statusCounts: Record<string, number>;
    labels: {
        stats_total_invoiced: string;
        stats_invoices_count: string;
        stats_collected: string;
        stats_paid_count: string;
        stats_pending: string;
        stats_open_count: string;
        stats_overdue: string;
        stats_overdue_count: string;
    };
};

export function InvoicesStatsCards({ stats, statusCounts, labels }: InvoicesStatsCardsProps) {
    const cards = [
        {
            label: labels.stats_total_invoiced,
            value: formatCurrency(stats.totalAmount),
            detail: labels.stats_invoices_count.replace("{count}", stats.totalCount.toString()),
            className: "border-accent/20 bg-accent/5 text-accent",
        },
        {
            label: labels.stats_collected,
            value: formatCurrency(stats.paidAmount),
            detail: labels.stats_paid_count.replace("{count}", (statusCounts.paid || 0).toString()),
            className: "border-[color-mix(in_srgb,var(--color-green-500)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-green-500)_10%,transparent)] text-[var(--color-green-700)]",
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace("{count}", ((statusCounts.draft || 0) + (statusCounts.issued || 0)).toString()),
            className: "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            className: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
        },
    ];

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm">
                    <div className={`mb-4 h-1.5 w-20 rounded-full border ${stat.className}`} />
                    <p className="text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">{stat.label}</p>
                    <p className="mt-2 text-2xl font-black leading-tight text-[var(--text-main)]">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{stat.detail}</p>
                </div>
            ))}
        </div>
    );
}
