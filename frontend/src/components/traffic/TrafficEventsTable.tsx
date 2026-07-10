"use client";

import { MonitorSmartphone } from "lucide-react";

import {
    fallbackTraffic,
    formatDateTime,
    getDeviceLabel,
    getGeoLabel,
    TRAFFIC_PAGE_SIZE,
    type TrafficLabels,
} from "@/lib/traffic/traffic-page-utils";
import { AuditLog } from "@/types/audit-log";

type TrafficTab = "logins" | "url_only";

type TrafficEventsTableProps = {
    traffic: TrafficLabels;
    locale: "en" | "es";
    activeTab: TrafficTab;
    onTabChange: (tab: TrafficTab) => void;
    loginEventCount: number;
    anonymousUrlEventCount: number;
    paginatedEvents: AuditLog[];
    visibleEventCount: number;
    currentPage: number;
    visiblePageCount: number;
    onPageChange: (page: number) => void;
};

export function TrafficEventsTable({
    traffic,
    locale,
    activeTab,
    onTabChange,
    loginEventCount,
    anonymousUrlEventCount,
    paginatedEvents,
    visibleEventCount,
    currentPage,
    visiblePageCount,
    onPageChange,
}: TrafficEventsTableProps) {
    const safeCurrentPage = Math.min(currentPage, visiblePageCount);

    return (
        <section className="overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-black text-[var(--text-main)]">{traffic.table_title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{traffic.table_subtitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-1">
                    {[
                        { id: "logins" as const, label: traffic.tab_logins, count: loginEventCount },
                        { id: "url_only" as const, label: traffic.tab_url_only, count: anonymousUrlEventCount },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                activeTab === tab.id
                                    ? "bg-[var(--bg-card-solid)] text-[var(--text-main)] shadow-sm"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            }`}
                        >
                            {tab.label} · {tab.count}
                        </button>
                    ))}
                </div>
            </div>
            <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-[var(--bg-secondary)] text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                        {activeTab === "logins" ? (
                            <tr>
                                <th className="px-4 py-3">{traffic.user}</th>
                                <th className="px-4 py-3">{traffic.company}</th>
                                <th className="px-4 py-3">{traffic.location}</th>
                                <th className="px-4 py-3">{traffic.ip}</th>
                                <th className="px-4 py-3">{traffic.device}</th>
                                <th className="px-4 py-3">{traffic.time}</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-4 py-3">{traffic.visitor}</th>
                                <th className="px-4 py-3">{traffic.page}</th>
                                <th className="px-4 py-3">{traffic.referrer}</th>
                                <th className="px-4 py-3">{traffic.location}</th>
                                <th className="px-4 py-3">{traffic.device}</th>
                                <th className="px-4 py-3">{traffic.time}</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]">
                        {paginatedEvents.map((event) => (
                            activeTab === "logins" ? (
                                <tr key={event.id}>
                                    <td className="px-4 py-3">
                                        <p className="font-black text-[var(--text-main)]">{event.details.user_name || traffic.unknown_user}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{event.details.user_email || "-"}</p>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">{event.details.company_name || "-"}</td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">{getGeoLabel(event)}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-main)]">{event.details.ip || event.ip_address || "-"}</td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-bold">
                                            <MonitorSmartphone className="h-3.5 w-3.5" />
                                            {getDeviceLabel(event.details.user_agent, traffic)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-main)]">{formatDateTime(event.created_at, locale)}</td>
                                </tr>
                            ) : (
                                <tr key={event.id}>
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-xs font-black text-[var(--text-main)]">
                                            {(event.details.visitor_id || "-").slice(0, 12)}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">{event.details.language || "-"}</p>
                                    </td>
                                    <td className="max-w-[18rem] px-4 py-3 text-[var(--text-muted)]">
                                        <p className="truncate font-bold text-[var(--text-main)]">{event.details.path || "-"}</p>
                                        <p className="truncate text-xs">{event.details.title || "-"}</p>
                                    </td>
                                    <td className="max-w-[14rem] px-4 py-3 text-xs text-[var(--text-muted)]">
                                        <p className="truncate">{event.details.referrer || "-"}</p>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">
                                        <p>{getGeoLabel(event)}</p>
                                        <p className="font-mono text-xs">{event.details.ip || event.ip_address || "-"}</p>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-muted)]">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-bold">
                                            <MonitorSmartphone className="h-3.5 w-3.5" />
                                            {getDeviceLabel(event.details.user_agent, traffic)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-main)]">{formatDateTime(event.created_at, locale)}</td>
                                </tr>
                            )
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="grid gap-3 p-3 lg:hidden">
                {paginatedEvents.map((event) => (
                    <article key={event.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate font-black text-[var(--text-main)]">
                                    {activeTab === "logins"
                                        ? event.details.user_name || traffic.unknown_user
                                        : event.details.path || traffic.visitor}
                                </p>
                                <p className="truncate text-xs text-[var(--text-muted)]">
                                    {activeTab === "logins"
                                        ? event.details.user_email || "-"
                                        : (event.details.visitor_id || "-").slice(0, 12)}
                                </p>
                            </div>
                            <span className="rounded-full bg-[var(--bg-card)] px-2 py-1 text-[10px] font-black text-[var(--text-muted)]">
                                {getDeviceLabel(event.details.user_agent, traffic)}
                            </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)]">
                            <p>{traffic.time}: <span className="font-mono text-[var(--text-main)]">{formatDateTime(event.created_at, locale)}</span></p>
                            <p>{traffic.location}: {getGeoLabel(event)}</p>
                            <p>{traffic.ip}: <span className="font-mono text-[var(--text-main)]">{event.details.ip || event.ip_address || "-"}</span></p>
                            {activeTab === "url_only" && <p>{traffic.referrer}: {event.details.referrer || "-"}</p>}
                        </div>
                    </article>
                ))}
            </div>
            {visibleEventCount === 0 && (
                <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                    {traffic.empty}
                </div>
            )}
            {visibleEventCount > TRAFFIC_PAGE_SIZE && (
                <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-bold text-[var(--text-muted)]">
                        {(traffic.page_of || fallbackTraffic[locale].page_of)
                            .replace("{page}", safeCurrentPage.toString())
                            .replace("{pages}", visiblePageCount.toString())}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-black text-[var(--text-main)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-45"
                        >
                            {traffic.previous || fallbackTraffic[locale].previous}
                        </button>
                        <button
                            type="button"
                            disabled={currentPage >= visiblePageCount}
                            onClick={() => onPageChange(Math.min(visiblePageCount, currentPage + 1))}
                            className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-black text-[var(--text-main)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-45"
                        >
                            {traffic.next || fallbackTraffic[locale].next}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
