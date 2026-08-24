"use client";

import dynamic from "next/dynamic";

import { TrafficStatsCards } from "@/components/traffic/TrafficStatsCards";
import { formatDate } from "@/lib/format";
import type { TrafficMapPoint } from "@/lib/traffic-map";
import { formatDateTime, type TrafficLabels } from "@/lib/traffic/traffic-page-utils";
import { AuditLog } from "@/types/audit-log";

const TrafficAccessMap = dynamic(
    () => import("@/components/dashboard/TrafficAccessMap").then(({ TrafficAccessMap }) => TrafficAccessMap),
    {
        ssr: false,
        loading: () => (
            <div
                aria-busy="true"
                className="h-[14rem] animate-pulse rounded-[18px] bg-[var(--bg-tertiary)] motion-reduce:animate-none sm:h-[18rem]"
            />
        ),
    },
);

type TrafficStats = {
    total: number;
    last24h: number;
    last7d: number;
    uniqueUsers: number;
    locations: number;
};

type TrendItem = {
    date: string;
    count: number;
    height: number;
};

type PlatformStat = {
    label: string;
    count: number;
    percent: number;
    color: string;
};

type HeatmapData = {
    days: string[];
    hours: number[];
    cells: Array<Array<{ key: string; count: number; opacity: number }>>;
};

type TrafficAnalyticsPanelProps = {
    traffic: TrafficLabels;
    locale: "en" | "es";
    stats: TrafficStats;
    loginEventCount: number;
    anonymousUrlEventCount: number;
    latestEvent: AuditLog | undefined;
    mapPoints: TrafficMapPoint[];
    trend: TrendItem[];
    platformStats: PlatformStat[];
    heatmap: HeatmapData;
};

export function TrafficAnalyticsPanel({
    traffic,
    locale,
    stats,
    loginEventCount,
    anonymousUrlEventCount,
    latestEvent,
    mapPoints,
    trend,
    platformStats,
    heatmap,
}: TrafficAnalyticsPanelProps) {
    const lastEventLabel = latestEvent
        ? formatDateTime(latestEvent.created_at, locale).split(",").pop()?.trim() || "-"
        : "-";
    const chartStops = platformStats.reduce<string[]>((stops, item, index) => {
        const start = platformStats
            .slice(0, index)
            .reduce((sum, previous) => sum + previous.percent, 0);
        const end = index === platformStats.length - 1 ? 100 : start + item.percent;
        stops.push(`${item.color} ${start}% ${end}%`);
        return stops;
    }, []);

    return (
        <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {traffic.reach_period}
            </p>

            <TrafficStatsCards
                locale={locale}
                traffic={traffic}
                total={stats.total}
                last7d={stats.last7d}
                last24h={stats.last24h}
                uniqueUsers={stats.uniqueUsers}
                firstTimeVisits={anonymousUrlEventCount}
                loginEventCount={loginEventCount}
                lastEventLabel={lastEventLabel}
            />

            <section className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{traffic.map_title}</h2>
                        <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {traffic.map_subtitle}
                        </p>
                    </div>
                    <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:inline">
                        {traffic.view_details}
                    </span>
                </div>
                <TrafficAccessMap
                    points={mapPoints}
                    emptyDescription={traffic.no_map_points_desc}
                    activeLocationsLabel={traffic.active_locations}
                />
            </section>

            <section className="grid gap-2.5 xl:grid-cols-3">
                <article className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{traffic.direct_organic}</h2>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            {traffic.month}
                        </span>
                    </div>
                    <div className="mt-4 flex h-52 items-end gap-1.5">
                        {trend.map((item, index) => (
                            <div key={item.date} className="flex flex-1 flex-col items-center gap-1.5">
                                <div className="flex h-44 w-full items-end gap-0.5 rounded-xl bg-[var(--bg-primary)]/50 p-1">
                                    <div
                                        className="w-full rounded-lg bg-accent opacity-85"
                                        style={{ height: `${item.height}%` }}
                                    />
                                    <div
                                        className="w-full rounded-lg bg-[var(--text-muted)] opacity-25"
                                        style={{
                                            height: `${Math.max(8, item.height - 18 + (index % 3) * 8)}%`,
                                        }}
                                    />
                                </div>
                                <span className="text-[9px] font-medium text-[var(--text-muted)]">
                                    {formatDate(item.date).slice(0, 5)}
                                </span>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{traffic.users_by_platform}</h2>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            {traffic.month}
                        </span>
                    </div>
                    <div className="mt-5 flex items-center justify-center">
                        <div
                            className="relative h-40 w-40 rounded-full"
                            style={{
                                background: `conic-gradient(${chartStops.join(", ")})`,
                            }}
                        >
                            <div className="absolute inset-8 rounded-full bg-[var(--bg-tertiary)]" />
                        </div>
                    </div>
                    <div className="mt-4 grid gap-1.5">
                        {platformStats.map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-xs">
                                <span className="inline-flex items-center gap-2 font-medium text-[var(--text-muted)]">
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: item.color }}
                                        aria-hidden="true"
                                    />
                                    {item.label}
                                </span>
                                <span className="font-mono font-semibold text-[var(--text-main)]">
                                    {item.percent}%
                                </span>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-[var(--text-main)]">{traffic.activity_heatmap}</h2>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            {traffic.month}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-1.5">
                        {heatmap.cells.map((row, rowIndex) => (
                            <div
                                key={heatmap.hours[rowIndex]}
                                className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] items-center gap-1.5"
                            >
                                <span className="text-[10px] font-medium text-[var(--text-muted)]">
                                    {heatmap.hours[rowIndex]}h
                                </span>
                                {row.map((cell) => (
                                    <span
                                        key={cell.key}
                                        className="h-5 rounded-md bg-accent"
                                        style={{ opacity: cell.opacity }}
                                    />
                                ))}
                            </div>
                        ))}
                        <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1.5">
                            <span />
                            {heatmap.days.map((day) => (
                                <span
                                    key={day}
                                    className="text-center text-[9px] font-medium text-[var(--text-muted)]"
                                >
                                    {day}
                                </span>
                            ))}
                        </div>
                    </div>
                </article>
            </section>
        </div>
    );
}
