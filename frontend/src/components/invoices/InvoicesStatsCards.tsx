"use client";

import { Clock3, FilePenLine, FileText, OctagonAlert } from "lucide-react";

import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { formatCurrency } from "@/lib/format";
import type { InvoiceAttention } from "@/lib/finance-workspace";

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
    attention?: InvoiceAttention;
    onAttentionChange?: (value: InvoiceAttention) => void;
    draftCount?: number;
    recordCount?: number;
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

export function InvoicesStatsCards({ stats, statusCounts, labels, attention = "all", onAttentionChange, draftCount = 0, recordCount = stats.totalCount + draftCount }: InvoicesStatsCardsProps) {
    const cards = [
        {
            label: "Facturas de esta vista",
            value: String(recordCount),
            detail: `Facturado: ${formatCurrency(stats.totalAmount)} · ver documentos`,
            icon: FileText,
            filter: "all" as const,
        },
        {
            label: "Borradores",
            value: String(draftCount),
            detail: "Pendientes de emitir · ver facturas",
            icon: FilePenLine,
            filter: "draft" as const,
        },
        {
            label: labels.stats_pending,
            value: formatCurrency(stats.openAmount),
            detail: labels.stats_open_count.replace(
                "{count}",
                stats.openCount.toString(),
            ),
            icon: Clock3,
            filter: "pending" as const,
        },
        {
            label: labels.stats_overdue,
            value: formatCurrency(stats.overdueAmount),
            detail: labels.stats_overdue_count.replace("{count}", (statusCounts.overdue || 0).toString()),
            icon: OctagonAlert,
            filter: "overdue" as const,
        },
    ];

    return (
        <SummaryMetricGrid desktopColumns={4} aria-label="Resumen de facturas">
            {cards.map((stat) => (
                <FinanceMetricButton
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    description={stat.detail}
                    icon={stat.icon}
                    active={attention === stat.filter}
                    attention={stat.filter === "overdue" && stats.overdueAmount > 0}
                    onClick={() => onAttentionChange?.(stat.filter)}
                />
            ))}
        </SummaryMetricGrid>
    );
}
