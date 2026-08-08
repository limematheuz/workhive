"use client";

import { type ReactNode } from "react";
import {
    Building2,
    ClipboardList,
    FlaskConical,
    KeyRound,
    ShieldCheck,
    Users,
} from "lucide-react";

import type { SuperadminDashboardStats } from "@/lib/superadmin-dashboard-stats";
import { useDictionary } from "@/lib/dictionary-context";

type SuperadminStatsCardsProps = {
    stats: SuperadminDashboardStats;
    loading?: boolean;
};

export function SuperadminStatsCards({ stats, loading = false }: SuperadminStatsCardsProps) {
    const { dict } = useDictionary();
    const text = dict.superadmin;

    const cards = [
        {
            label: text.metric_companies,
            value: stats.companies,
            icon: <Building2 className="h-4 w-4" />,
        },
        {
            label: text.metric_active,
            value: stats.activeCompanies,
            icon: <ShieldCheck className="h-4 w-4" />,
        },
        {
            label: text.metric_trial,
            value: stats.trialCompanies,
            icon: <FlaskConical className="h-4 w-4" />,
        },
        {
            label: text.metric_team,
            value: stats.teamMembers,
            icon: <Users className="h-4 w-4" />,
        },
        {
            label: text.metric_roles,
            value: stats.roles,
            icon: <KeyRound className="h-4 w-4" />,
        },
        {
            label: text.metric_pending_trials,
            value: stats.pendingTrialRequests,
            icon: <ClipboardList className="h-4 w-4" />,
        },
    ];

    return (
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
                <SummaryCard
                    key={card.label}
                    label={card.label}
                    value={loading ? "—" : card.value.toString()}
                    icon={card.icon}
                />
            ))}
        </section>
    );
}

function SummaryCard({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: ReactNode;
}) {
    return (
        <article className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5">
            <span
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                aria-hidden="true"
            >
                {icon}
            </span>
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                {value}
            </p>
        </article>
    );
}
