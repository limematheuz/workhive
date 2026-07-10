"use client";

import { Download, FileText, MoreHorizontal, Search } from "lucide-react";

import { TrafficAccessMap } from "@/components/dashboard/TrafficAccessMap";
import { formatDate } from "@/lib/format";
import type { TrafficMapPoint } from "@/lib/traffic-map";
import { formatDateTime, type TrafficLabels } from "@/lib/traffic/traffic-page-utils";
import { AuditLog } from "@/types/audit-log";

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
    return (
        <section className="rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-card-solid)] p-2.5 shadow-sm sm:p-3">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{traffic.eyebrow}</p>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--text-main)]">{traffic.title}</h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{traffic.reach_period}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)] sm:w-80">
                        <Search className="h-4 w-4" />
                        <span className="text-sm">{traffic.search}</span>
                    </div>
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-black text-[var(--text-main)]">
                        <FileText className="h-4 w-4" />
                        {traffic.summary}
                    </button>
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2 text-sm font-black text-white">
                        <Download className="h-4 w-4" />
                        {traffic.download}
                    </button>
                </div>
            </header>

            <section className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: traffic.total_accesses, value: stats.total.toLocaleString(), delta: `+${stats.last7d} ${traffic.last_7d}` },
                    { label: traffic.first_time_visits, value: anonymousUrlEventCount.toLocaleString(), delta: `+${stats.last24h} ${traffic.last_24h}` },
                    { label: traffic.repeat_viewers, value: loginEventCount.toLocaleString(), delta: `${stats.uniqueUsers} ${traffic.unique_users}` },
                    { label: traffic.avg_engagement, value: latestEvent ? formatDateTime(latestEvent.created_at, locale).split(",").pop()?.trim() || "-" : "-", delta: traffic.last_event },
                ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-3 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold text-[var(--text-muted)]">{card.label}</p>
                            <MoreHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                        <p className="mt-3 font-mono text-3xl font-black text-[var(--text-main)]">{card.value}</p>
                        <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{card.delta}</p>
                    </div>
                ))}
            </section>

            <section className="mt-3">
                <div className="mb-1 flex items-center justify-between gap-3 px-1">
                    <h2 className="text-[17px] font-black text-[var(--text-main)]">{traffic.map_title}</h2>
                    <span className="hidden text-[13px] font-bold text-[var(--text-muted)] sm:inline">{traffic.view_details}</span>
                </div>
                <TrafficAccessMap
                    points={mapPoints}
                    emptyDescription={traffic.no_map_points_desc}
                    activeLocationsLabel={traffic.active_locations}
                />
            </section>

            <section className="mt-3 grid gap-3 xl:grid-cols-3">
                <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-[var(--text-main)]">{traffic.direct_organic}</h2>
                        <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">{traffic.month}</span>
                    </div>
                    <div className="mt-6 flex h-64 items-end gap-2">
                        {trend.map((item, index) => (
                            <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                                <div className="flex h-52 w-full items-end gap-1 rounded-2xl bg-[var(--bg-secondary)] p-1.5">
                                    <div className="w-full rounded-xl bg-accent opacity-80" style={{ height: `${item.height}%` }} />
                                    <div className="w-full rounded-xl bg-[var(--text-muted)] opacity-30" style={{ height: `${Math.max(8, item.height - 18 + (index % 3) * 8)}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-[var(--text-muted)]">{formatDate(item.date).slice(0, 5)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-[var(--text-main)]">{traffic.users_by_platform}</h2>
                        <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">{traffic.month}</span>
                    </div>
                    <div className="mt-8 flex items-center justify-center">
                        <div
                            className="relative h-48 w-48 rounded-full"
                            style={{
                                background: `conic-gradient(${platformStats[0].color} 0 ${platformStats[0].percent}%, ${platformStats[1].color} ${platformStats[0].percent}% ${platformStats[0].percent + platformStats[1].percent}%, ${platformStats[2].color} ${platformStats[0].percent + platformStats[1].percent}% 100%)`,
                            }}
                        >
                            <div className="absolute inset-10 rounded-full bg-[var(--bg-card-solid)]" />
                        </div>
                    </div>
                    <div className="mt-6 grid gap-2">
                        {platformStats.map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                                <span className="font-bold text-[var(--text-muted)]">{item.label}</span>
                                <span className="font-mono font-black text-[var(--text-main)]">{item.percent}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-[var(--text-main)]">{traffic.activity_heatmap}</h2>
                        <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-bold text-[var(--text-muted)]">{traffic.month}</span>
                    </div>
                    <div className="mt-6 grid gap-2">
                        {heatmap.cells.map((row, rowIndex) => (
                            <div key={heatmap.hours[rowIndex]} className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] items-center gap-2">
                                <span className="text-xs font-bold text-[var(--text-muted)]">{heatmap.hours[rowIndex]}h</span>
                                {row.map((cell) => (
                                    <span
                                        key={cell.key}
                                        className="h-6 rounded-md bg-accent"
                                        style={{ opacity: cell.opacity }}
                                    />
                                ))}
                            </div>
                        ))}
                        <div className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-2">
                            <span />
                            {heatmap.days.map((day) => (
                                <span key={day} className="text-center text-[10px] font-bold text-[var(--text-muted)]">{day}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </section>
    );
}
