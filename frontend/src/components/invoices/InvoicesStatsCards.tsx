"use client";

import { CircleCheck, Clock3, FileText, OctagonAlert } from "lucide-react";

import { SummaryMetricCard } from "@/components/ui/summary-metric-card";
import { formatCurrency } from "@/lib/format";
import { getPercentageChange } from "@/lib/metric-trend";

export type InvoiceStats = {
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    openAmount: number;
    overdueAmount: number;
};

type InvoicesStatsCardsProps = {
    stats: InvoiceStats;
    previousStats?: InvoiceStats | null;
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

export function InvoicesStatsCards({ stats, previousStats = null, statusCounts, labels }: InvoicesStatsCardsProps) {
    const getTrend = (current: number, previous: number, comparisonDirection?: "higher" | "lower") => {
        const value = getPercentageChange(current, previous);
        return value === null ? undefined : { value, comparisonDirection };
    };
    const cards = [
        {
            label: labels.stats_total_invoiced,
            value: formatCurrency(stats.totalAmount),
            detail: labels.stats_invoices_count.replace("{count}", stats.totalCount.toString()),
            icon: FileText,
            trend: previousStats ? getTrend(stats.totalAmount, previousStats.totalAmount) : undefined,
        },
        {
            label: labels.stats_collected,
            value: formatCurrency(stats.paidAmount),
            detail: labels.stats_paid_count.replace("{count}", (statusCounts.paid || 0).toString()),
            icon: CircleCheck,
            trend: previousStats ? getTrend(stats.paidAmount, previousStats.paidAmount) : undefined,
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace(
                "{count}",
                ((statusCounts.draft || 0) + (statusCounts.issued || 0)).toString(),
            ),
            icon: Clock3,
            trend: previousStats ? getTrend(stats.openAmount, previousStats.openAmount, "lower") : undefined,
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            icon: OctagonAlert,
            trend: previousStats ? getTrend(stats.overdueAmount, previousStats.overdueAmount, "lower") : undefined,
        },
    ];

    return (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumen de facturas">
            {cards.map((stat) => (
                <SummaryMetricCard
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    description={stat.detail}
                    icon={stat.icon}
                    trend={stat.trend}
                />
            ))}
        </section>
    );
}
