"use client";

import { Globe2, Link2, LogIn, Monitor, Smartphone, Tablet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import {
    fallbackTraffic,
    formatDateTime,
    getDeviceKind,
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
    const isLoginsTab = activeTab === "logins";

    const deviceBadge = (event: AuditLog) => {
        const deviceKind = getDeviceKind(event.details.user_agent);
        const presentation = {
            desktop: {
                icon: Monitor,
                className: "border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-[var(--brand-blue)]",
            },
            mobile: {
                icon: Smartphone,
                className: "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
            },
            tablet: {
                icon: Tablet,
                className: "border-[color-mix(in_srgb,var(--brand-blue-sky-deep)_42%,var(--border-soft))] bg-[color-mix(in_srgb,var(--brand-blue-sky-deep)_14%,var(--bg-card-solid))] text-[var(--brand-blue-hover)]",
            },
            browser: {
                icon: Globe2,
                className: "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]",
            },
        }[deviceKind];
        const Icon = presentation.icon;

        return (
            <Badge variant="outline" className={`gap-1.5 font-medium ${presentation.className}`}>
                <Icon className="h-3 w-3" />
                {getDeviceLabel(event.details.user_agent, traffic)}
            </Badge>
        );
    };

    return (
        <section className="billing-block overflow-hidden rounded-[18px] border border-[var(--border-soft)]">
            <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{traffic.table_title}</h2>
                    <p className="mt-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {traffic.table_subtitle}
                    </p>
                </div>
                <PremiumTabs
                    layout="fit"
                    className="w-full lg:max-w-md"
                    tabs={[
                        {
                            id: "logins",
                            label: traffic.tab_logins,
                            icon: LogIn,
                            badge: loginEventCount,
                            badgeTone: "info",
                        },
                        {
                            id: "url_only",
                            label: traffic.tab_url_only,
                            icon: Link2,
                            badge: anonymousUrlEventCount,
                            badgeTone: "info",
                        },
                    ]}
                    activeTab={activeTab}
                    onChange={onTabChange}
                />
            </div>

            <div className="p-3 sm:p-4">
                <DataListTable
                    items={paginatedEvents}
                    getRowKey={(event) => event.id}
                    desktopFrom="lg"
                    variant="plain"
                    columns={isLoginsTab
                        ? [
                            { key: "user", label: traffic.user },
                            { key: "company", label: traffic.company },
                            { key: "location", label: traffic.location },
                            { key: "ip", label: traffic.ip },
                            { key: "device", label: traffic.device },
                            { key: "time", label: traffic.time },
                        ]
                        : [
                            { key: "visitor", label: traffic.visitor },
                            { key: "page", label: traffic.page },
                            { key: "referrer", label: traffic.referrer },
                            { key: "location", label: traffic.location },
                            { key: "device", label: traffic.device },
                            { key: "time", label: traffic.time },
                        ]}
                    empty={(
                        <p className="text-sm text-[var(--text-muted)]">{traffic.empty}</p>
                    )}
                    renderCompactRow={(event) => (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-[var(--text-main)]">
                                        {isLoginsTab
                                            ? event.details.user_name || traffic.unknown_user
                                            : event.details.path || traffic.visitor}
                                    </p>
                                    <p className="truncate text-xs text-[var(--text-muted)]">
                                        {isLoginsTab
                                            ? event.details.user_email || "-"
                                            : (event.details.visitor_id || "-").slice(0, 12)}
                                    </p>
                                </div>
                                {deviceBadge(event)}
                            </div>
                            <div className="mt-2.5 grid gap-1.5 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                                <p>
                                    {traffic.time}:{" "}
                                    <span className="font-mono text-[var(--text-main)]">
                                        {formatDateTime(event.created_at, locale)}
                                    </span>
                                </p>
                                <p>
                                    {traffic.location}: {getGeoLabel(event)}
                                </p>
                                <p>
                                    {traffic.ip}:{" "}
                                    <span className="font-mono text-[var(--text-main)]">
                                        {event.details.ip || event.ip_address || "-"}
                                    </span>
                                </p>
                                {isLoginsTab && event.details.company_name && (
                                    <p>
                                        {traffic.company}: {event.details.company_name}
                                    </p>
                                )}
                                {!isLoginsTab && (
                                    <p>
                                        {traffic.referrer}: {event.details.referrer || "-"}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                    renderDesktopRow={(event) => (
                        isLoginsTab ? (
                            <>
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-[var(--text-main)]">
                                        {event.details.user_name || traffic.unknown_user}
                                    </p>
                                    <p className="truncate text-xs text-[var(--text-muted)]">
                                        {event.details.user_email || "-"}
                                    </p>
                                </div>
                                <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">
                                    {event.details.company_name || "-"}
                                </p>
                                <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">
                                    {getGeoLabel(event)}
                                </p>
                                <p className="font-mono text-xs text-[var(--text-main)]">
                                    {event.details.ip || event.ip_address || "-"}
                                </p>
                                <div className="flex items-center">{deviceBadge(event)}</div>
                                <p className="font-mono text-xs text-[var(--text-main)]">
                                    {formatDateTime(event.created_at, locale)}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="min-w-0">
                                    <p className="font-mono text-xs font-semibold text-[var(--text-main)]">
                                        {(event.details.visitor_id || "-").slice(0, 12)}
                                    </p>
                                    <p className="truncate text-xs text-[var(--text-muted)]">
                                        {event.details.language || "-"}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-[var(--text-main)]">
                                        {event.details.path || "-"}
                                    </p>
                                    <p className="truncate text-xs text-[var(--text-muted)]">
                                        {event.details.title || "-"}
                                    </p>
                                </div>
                                <p className="min-w-0 truncate text-xs text-[var(--text-muted)]">
                                    {event.details.referrer || "-"}
                                </p>
                                <div className="min-w-0">
                                    <p className="text-sm text-[var(--text-muted)]">{getGeoLabel(event)}</p>
                                    <p className="font-mono text-xs text-[var(--text-main)]">
                                        {event.details.ip || event.ip_address || "-"}
                                    </p>
                                </div>
                                <div className="flex items-center">{deviceBadge(event)}</div>
                                <p className="font-mono text-xs text-[var(--text-main)]">
                                    {formatDateTime(event.created_at, locale)}
                                </p>
                            </>
                        )
                    )}
                />
            </div>

            {visibleEventCount > TRAFFIC_PAGE_SIZE && (
                <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        {(traffic.page_of || fallbackTraffic[locale].page_of)
                            .replace("{page}", safeCurrentPage.toString())
                            .replace("{pages}", visiblePageCount.toString())}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={currentPage <= 1}
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        >
                            {traffic.previous || fallbackTraffic[locale].previous}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={currentPage >= visiblePageCount}
                            onClick={() => onPageChange(Math.min(visiblePageCount, currentPage + 1))}
                        >
                            {traffic.next || fallbackTraffic[locale].next}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
