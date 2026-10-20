"use client";

import { CircleCheck, Clock3, FileText, OctagonAlert } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { formatCurrency } from "@/lib/format";
import { getMetricTrend } from "@/lib/metric-trend";

export type InvoiceStats = {
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    openCount: number;
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
    const cards = [
        {
            label: labels.stats_total_invoiced,
            value: formatCurrency(stats.totalAmount),
            detail: labels.stats_invoices_count.replace("{count}", stats.totalCount.toString()),
            icon: FileText,
            trend: previousStats ? getMetricTrend(stats.totalAmount, previousStats.totalAmount) : undefined,
        },
        {
            label: labels.stats_collected,
            value: formatCurrency(stats.paidAmount),
            detail: labels.stats_paid_count.replace("{count}", (statusCounts.paid || 0).toString()),
            icon: CircleCheck,
            trend: previousStats ? getMetricTrend(stats.paidAmount, previousStats.paidAmount) : undefined,
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace(
                "{count}",
                stats.openCount.toString(),
            ),
            icon: Clock3,
            trend: previousStats ? getMetricTrend(stats.openAmount, previousStats.openAmount, "lower") : undefined,
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            icon: OctagonAlert,
            trend: previousStats ? getMetricTrend(stats.overdueAmount, previousStats.overdueAmount, "lower") : undefined,
        },
    ];

    return (
        <SummaryMetricGrid desktopColumns={4} aria-label="Resumen de facturas">
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
        </SummaryMetricGrid>
    );
}
