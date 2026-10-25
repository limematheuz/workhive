"use client";

import { CircleAlert, CircleCheck, Clock3, ReceiptText, UsersRound } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { formatCurrency } from "@/lib/format";
import { useDictionary } from "@/lib/dictionary-context";
import { getPercentageChange } from "@/lib/metric-trend";
import type { ClientWorkspaceMonthlyRevenue, ClientWorkspaceSummary } from "@/lib/client-workspace";

type ClientWorkspaceStatsProps = {
    summary: ClientWorkspaceSummary;
    monthlyRevenue: ClientWorkspaceMonthlyRevenue | null;
};

export function ClientWorkspaceStats({ summary, monthlyRevenue }: ClientWorkspaceStatsProps) {
    const { dict } = useDictionary();
    const workspace = dict.clients.workspace;
    const monthlyRevenueTrend = monthlyRevenue
        ? getPercentageChange(monthlyRevenue.current, monthlyRevenue.previous)
        : null;
    const cards = [
        {
            label: workspace.stats_total,
            value: String(summary.clientCount),
            icon: UsersRound,
        },
        {
            label: workspace.stats_active,
            value: String(summary.activeClientCount),
            icon: CircleCheck,
        },
        {
            label: workspace.stats_pending_contact,
            description: workspace.stats_pending_contact_description,
            value: String(summary.missingContactCount),
            icon: Clock3,
        },
        summary.hasFinancialData
            ? {
                label: workspace.stats_balance,
                value: formatCurrency(summary.pendingBalanceTotal),
                icon: CircleAlert,
            }
            : {
                label: workspace.stats_locations,
                value: String(summary.locationCount),
                icon: UsersRound,
            },
        summary.hasFinancialData
            ? {
                label: workspace.stats_billing_month,
                value: formatCurrency(monthlyRevenue?.current ?? 0),
                icon: ReceiptText,
                trend: monthlyRevenueTrend !== null
                    ? { value: monthlyRevenueTrend }
                    : undefined,
            }
            : {
                label: workspace.stats_pending_jobs,
                value: String(summary.pendingTaskCount),
                icon: CircleAlert,
            },
    ];

    return (
        <SummaryMetricGrid desktopColumns={5} aria-label={workspace.stats_label}>
            {cards.map((card) => {
                return (
                    <SummaryMetricCard key={card.label} {...card} />
                );
            })}
        </SummaryMetricGrid>
    );
}
