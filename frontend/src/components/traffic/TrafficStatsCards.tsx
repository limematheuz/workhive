"use client";

import { type ReactNode } from "react";
import { Clock3, Eye, LogIn, MousePointerClick } from "lucide-react";

import type { TrafficLabels } from "@/lib/traffic/traffic-page-utils";

type TrafficStatsCardsProps = {
    traffic: TrafficLabels;
    locale: "en" | "es";
    total: number;
    last7d: number;
    last24h: number;
    uniqueUsers: number;
    firstTimeVisits: number;
    loginEventCount: number;
    lastEventLabel: string;
};

function formatCount(value: number, locale: "en" | "es") {
    return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US").format(value);
}

export function TrafficStatsCards({
    traffic,
    locale,
    total,
    last7d,
    last24h,
    uniqueUsers,
    firstTimeVisits,
    loginEventCount,
    lastEventLabel,
}: TrafficStatsCardsProps) {
    const cards = [
        {
            label: traffic.total_accesses,
            value: formatCount(total, locale),
            hint: `+${last7d} ${traffic.last_7d}`,
            icon: <MousePointerClick className="h-4 w-4" />,
        },
        {
            label: traffic.first_time_visits,
            value: formatCount(firstTimeVisits, locale),
            hint: `+${last24h} ${traffic.last_24h}`,
            icon: <Eye className="h-4 w-4" />,
        },
        {
            label: traffic.repeat_viewers,
            value: formatCount(loginEventCount, locale),
            hint: `${formatCount(uniqueUsers, locale)} ${traffic.unique_users}`,
            icon: <LogIn className="h-4 w-4" />,
        },
        {
            label: traffic.avg_engagement,
            value: lastEventLabel,
            hint: traffic.last_event,
            icon: <Clock3 className="h-4 w-4" />,
        },
    ];

    return (
        <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {cards.map((card) => (
                <SummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    hint={card.hint}
                    icon={card.icon}
                />
            ))}
        </section>
    );
}

function SummaryCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
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
            <p className="mt-1 truncate text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
                {value}
            </p>
            <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)]">{hint}</p>
        </article>
    );
}
