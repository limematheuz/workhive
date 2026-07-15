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
            barClassName: "bg-accent",
        },
        {
            label: labels.stats_collected,
            value: formatCurrency(stats.paidAmount),
            detail: labels.stats_paid_count.replace("{count}", (statusCounts.paid || 0).toString()),
            barClassName: "bg-[var(--color-green-600)]",
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace(
                "{count}",
                ((statusCounts.draft || 0) + (statusCounts.issued || 0)).toString(),
            ),
            barClassName: "bg-[var(--alert-warning-text)]",
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            barClassName: "bg-[var(--btn-cancel-hover-bg)]",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((stat) => (
                <div
                    key={stat.label}
                    className="surface-glass-card rounded-3xl p-3 sm:p-4"
                >
                    <div className={`mb-3 h-1.5 w-full rounded-full sm:mb-4 ${stat.barClassName}`} />
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)] sm:text-[11px]">
                        {stat.label}
                    </p>
                    <p className="mt-2 text-lg font-black leading-tight text-[var(--text-main)] sm:text-2xl">
                        {stat.value}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
                        {stat.detail}
                    </p>
                </div>
            ))}
        </div>
    );
}
