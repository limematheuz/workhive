"use client";

import { type ReactNode } from "react";
import { Clock3, MapPin, Users } from "lucide-react";

import { useDictionary } from "@/lib/dictionary-context";

type LiveWorkStatsCardsProps = {
    workerCount: number;
    locationCount: number;
    lastUpdatedAt: number;
};

export function LiveWorkStatsCards({
    workerCount,
    locationCount,
    lastUpdatedAt,
}: LiveWorkStatsCardsProps) {
    const { dict, locale } = useDictionary();

    const cards = [
        {
            label: dict.work_sessions?.live_workers || "Trabajadores activos",
            value: workerCount.toString(),
            icon: <Users className="h-4 w-4" />,
        },
        {
            label: dict.work_sessions?.live_locations || "Ubicaciones activas",
            value: locationCount.toString(),
            icon: <MapPin className="h-4 w-4" />,
        },
        {
            label: dict.work_sessions?.last_update || "Última actualización",
            value: new Date(lastUpdatedAt).toLocaleTimeString(
                locale === "es" ? "es-ES" : "en-US",
                { timeZone: "UTC" },
            ),
            icon: <Clock3 className="h-4 w-4" />,
        },
    ];

    return (
        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {cards.map((card) => (
                <SummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
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
        <article className="billing-block rounded-[18px] p-3.5">
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
