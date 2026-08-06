"use client";

import { CircleCheck, Clock3, FileText, OctagonAlert } from "lucide-react";

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
            icon: FileText,
            accentClassName: "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]",
        },
        {
            label: labels.stats_collected,
            value: formatCurrency(stats.paidAmount),
            detail: labels.stats_paid_count.replace("{count}", (statusCounts.paid || 0).toString()),
            icon: CircleCheck,
            accentClassName: "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--text-main)]",
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace(
                "{count}",
                ((statusCounts.draft || 0) + (statusCounts.issued || 0)).toString(),
            ),
            icon: Clock3,
            accentClassName: "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            icon: OctagonAlert,
            accentClassName: "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]",
        },
    ];

    return (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((stat) => (
                <article
                    key={stat.label}
                    className="billing-surface relative overflow-hidden rounded-[22px] p-4"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">
                                {stat.label}
                            </p>
                            <p className="mt-2 font-mono text-xl font-black leading-tight text-[var(--text-main)] sm:text-2xl">
                                {stat.value}
                            </p>
                        </div>
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${stat.accentClassName}`}>
                            <stat.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                    </div>
                    <p className="mt-3 text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
                        {stat.detail}
                    </p>
                </article>
            ))}
        </section>
    );
}
