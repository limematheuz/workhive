import {
    CalendarDays,
    CheckCircle2,
    CloudCog,
    Info,
    RefreshCw,
    ServerCog,
    ShieldCheck,
    TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import type { PlatformCalendarStatus } from "@/services/calendar.service";
import type { PlatformCalendarLabels } from "./PlatformCalendarOverview";

type PlatformCalendarStatusCardProps = {
    status: PlatformCalendarStatus;
    labels: PlatformCalendarLabels;
    saving: boolean;
    onToggle: (enabled: boolean) => void;
};

type StatusItem = {
    key: string;
    label: string;
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
    icon: ComponentType<{ className?: string }>;
};

const STATUS_GRID = "grid-cols-[minmax(12rem,1.4fr)_8rem]";

function StatusBadge({ active, activeLabel, inactiveLabel }: Omit<StatusItem, "key" | "label" | "icon">) {
    return (
        <Badge
            variant="outline"
            className={active
                ? "border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}
        >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-[var(--text-muted)]"}`} />
            {active ? activeLabel : inactiveLabel}
        </Badge>
    );
}

export function PlatformCalendarStatusCard({
    status,
    labels,
    saving,
    onToggle,
}: PlatformCalendarStatusCardProps) {
    const statusItems: StatusItem[] = [
        { key: "google_cloud", label: labels.google_cloud, active: status.google_cloud_configured, activeLabel: labels.configured, inactiveLabel: labels.not_configured, icon: CloudCog },
        { key: "environment", label: labels.environment, active: status.environment_enabled, activeLabel: labels.enabled, inactiveLabel: labels.disabled, icon: ServerCog },
        { key: "background_sync", label: labels.background_sync, active: status.background_sync_enabled, activeLabel: labels.enabled, inactiveLabel: labels.disabled, icon: RefreshCw },
    ];
    const diagnostics = [
        !status.google_cloud_configured ? labels.google_cloud_missing_hint : null,
        !status.environment_enabled ? labels.environment_disabled_hint : null,
        !status.background_sync_enabled ? labels.background_sync_disabled_hint : null,
        !status.company_connections_enabled ? labels.company_access_disabled_hint : null,
    ].filter((item): item is string => Boolean(item));

    return (
        <section className="billing-surface relative overflow-hidden rounded-[24px] p-3.5 sm:p-4">
            <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-[var(--text-main)]">Google Calendar</p>
                        <p className="text-xs text-[var(--text-muted)]">{labels.service_status}</p>
                    </div>
                </div>
                <Badge variant="outline" className={status.available
                    ? "border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent"
                    : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}
                >
                    {status.available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                    {status.available ? labels.available : labels.unavailable}
                </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-3">
                    <DataListTable
                        items={statusItems}
                        getRowKey={(item) => item.key}
                        gridClassName={STATUS_GRID}
                        desktopFrom="md"
                        variant="plain"
                        columns={[
                            { key: "check", label: labels.detail_column },
                            { key: "status", label: labels.status_column, className: "text-right" },
                        ]}
                        renderCompactRow={(item) => {
                            const Icon = item.icon;
                            return <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-card-solid)] text-accent"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="truncate text-sm font-medium text-[var(--text-main)]">{item.label}</span></div>
                                <StatusBadge {...item} />
                            </div>;
                        }}
                        renderDesktopRow={(item) => {
                            const Icon = item.icon;
                            return <><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-card-solid)] text-accent"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="truncate text-sm font-medium text-[var(--text-main)]">{item.label}</span></div><div className="flex justify-end"><StatusBadge {...item} /></div></>;
                        }}
                    />
                    {diagnostics.length > 0 && (
                        <div className="billing-block flex gap-3 rounded-2xl border border-[var(--border-soft)] px-3.5 py-3">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                            <div className="min-w-0"><p className="text-xs font-semibold text-[var(--text-main)]">{labels.status_attention}</p><ul className="mt-1 space-y-1 text-xs leading-5 text-[var(--text-muted)]">{diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul></div>
                        </div>
                    )}
                </div>
                <div className="billing-block flex flex-col justify-between rounded-[18px] border border-[var(--border-soft)] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" /><div><p className="text-sm font-semibold text-[var(--text-main)]">{labels.global_control}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{labels.company_toggle}</p></div></div>
                        <label className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center"><input type="checkbox" role="switch" aria-label={labels.company_toggle} aria-checked={status.company_connections_enabled} checked={status.company_connections_enabled} disabled={saving} onChange={(event) => onToggle(event.target.checked)} className="peer sr-only" /><span className="absolute inset-0 rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] transition-colors peer-checked:border-accent peer-checked:bg-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50" /><span className="absolute left-0.5 h-5 w-5 rounded-full bg-[var(--bg-card-solid)] shadow-sm transition-transform peer-checked:translate-x-5" /></label>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-xs"><span className="text-[var(--text-muted)]">{labels.company_access}</span><span className="font-semibold text-[var(--text-main)]">{status.company_connections_enabled ? labels.enabled : labels.disabled}</span></div>
                </div>
            </div>
        </section>
    );
}
