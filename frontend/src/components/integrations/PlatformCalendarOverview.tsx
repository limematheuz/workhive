import {
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    CloudCog,
    Copy,
    ExternalLink,
    Info,
    RefreshCw,
    ServerCog,
    ShieldCheck,
    TriangleAlert,
    UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { BrandIconWell } from "@/components/ui/brand-icon-well";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlatformCalendarStatus } from "@/services/calendar.service";

type PlatformCalendarLabels = {
    title: string;
    subtitle: string;
    available: string;
    unavailable: string;
    configured: string;
    not_configured: string;
    enabled: string;
    disabled: string;
    google_cloud: string;
    environment: string;
    background_sync: string;
    company_access: string;
    connected_companies: string;
    pending_requests: string;
    callback: string;
    timezone: string;
    open_google_cloud: string;
    company_toggle: string;
    service_status: string;
    global_control: string;
    technical_details: string;
    refresh: string;
    copy_callback: string;
    status_attention: string;
    google_cloud_missing_hint: string;
    environment_disabled_hint: string;
    background_sync_disabled_hint: string;
    company_access_disabled_hint: string;
};

type PlatformCalendarOverviewProps = {
    status: PlatformCalendarStatus;
    labels: PlatformCalendarLabels;
    saving: boolean;
    onToggle: (enabled: boolean) => void;
    onRefresh: () => void;
    onCopyCallback: () => void;
};

type StatusRowProps = {
    active: boolean;
    label: string;
    activeLabel: string;
    inactiveLabel: string;
    icon: ComponentType<{ className?: string }>;
};

function StatusRow({
    active,
    label,
    activeLabel,
    inactiveLabel,
    icon,
}: StatusRowProps) {
    return (
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
                <BrandIconWell icon={icon} size="sm" />
                <span className="truncate text-sm font-medium text-[var(--text-main)]">
                    {label}
                </span>
            </div>
            <Badge
                variant="secondary"
                className={cn(
                    "rounded-full px-2.5 py-1",
                    active
                        ? "border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-accent"
                        : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active ? "bg-accent" : "bg-[var(--text-muted)]",
                    )}
                />
                {active ? activeLabel : inactiveLabel}
            </Badge>
        </div>
    );
}

function Metric({
    icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
}) {
    return (
        <article className="surface-glass-card flex min-h-28 items-center justify-between rounded-2xl px-5 py-4">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {label}
                </p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--text-main)]">
                    {value}
                </p>
            </div>
            <BrandIconWell icon={icon} size="lg" />
        </article>
    );
}

export function PlatformCalendarOverview({
    status,
    labels,
    saving,
    onToggle,
    onRefresh,
    onCopyCallback,
}: PlatformCalendarOverviewProps) {
    const statusRows = [
        {
            label: labels.google_cloud,
            active: status.google_cloud_configured,
            activeLabel: labels.configured,
            inactiveLabel: labels.not_configured,
            icon: CloudCog,
        },
        {
            label: labels.environment,
            active: status.environment_enabled,
            activeLabel: labels.enabled,
            inactiveLabel: labels.disabled,
            icon: ServerCog,
        },
        {
            label: labels.background_sync,
            active: status.background_sync_enabled,
            activeLabel: labels.enabled,
            inactiveLabel: labels.disabled,
            icon: RefreshCw,
        },
    ];
    const diagnostics = [
        !status.google_cloud_configured ? labels.google_cloud_missing_hint : null,
        !status.environment_enabled ? labels.environment_disabled_hint : null,
        !status.background_sync_enabled ? labels.background_sync_disabled_hint : null,
        !status.company_connections_enabled ? labels.company_access_disabled_hint : null,
    ].filter((item): item is string => Boolean(item));

    return (
        <div className="mx-auto max-w-6xl space-y-5 px-[3%] py-6 text-[var(--text-main)] md:p-8">
            <header className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                    <BrandIconWell icon={CloudCog} size="lg" />
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
                            {labels.title}
                        </h2>
                        <p className="mt-0.5 text-sm leading-5 text-[var(--text-muted)]">
                            {labels.subtitle}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="rounded-[6px]"
                        onClick={onRefresh}
                        title={labels.refresh}
                        aria-label={labels.refresh}
                    >
                        <RefreshCw />
                    </Button>
                    <Button asChild className="rounded-full px-4">
                        <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <ExternalLink />
                            {labels.open_google_cloud}
                        </a>
                    </Button>
                </div>
            </header>

            <section className="surface-glass-card overflow-hidden rounded-2xl">
                <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <BrandIconWell icon={CalendarDays} />
                        <div>
                            <p className="text-sm font-semibold tracking-tight">Google Calendar</p>
                            <p className="text-xs text-[var(--text-muted)]">{labels.service_status}</p>
                        </div>
                    </div>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "rounded-full px-2.5 py-1",
                            status.available
                                ? "border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-accent"
                                : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                        )}
                    >
                        {status.available
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <TriangleAlert className="h-3.5 w-3.5" />}
                        {status.available ? labels.available : labels.unavailable}
                    </Badge>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="divide-y divide-[var(--border-soft)]">
                        {statusRows.map((row) => (
                            <StatusRow key={row.label} {...row} />
                        ))}
                        {diagnostics.length > 0 && (
                            <div className="flex gap-3 border-t border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] px-5 py-4">
                                <BrandIconWell icon={Info} size="sm" />
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[var(--text-main)]">
                                        {labels.status_attention}
                                    </p>
                                    <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--text-muted)]">
                                        {diagnostics.map((diagnostic) => (
                                            <li key={diagnostic}>{diagnostic}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-[var(--border-soft)] bg-[var(--brand-blue-soft)]/50 p-5 lg:border-l lg:border-t-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 gap-3">
                                <BrandIconWell icon={ShieldCheck} size="sm" />
                                <div>
                                    <p className="text-sm font-semibold tracking-tight">
                                        {labels.global_control}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                        {labels.company_toggle}
                                    </p>
                                </div>
                            </div>
                            <label className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    role="switch"
                                    aria-label={labels.company_toggle}
                                    aria-checked={status.company_connections_enabled}
                                    checked={status.company_connections_enabled}
                                    disabled={saving}
                                    onChange={(event) => onToggle(event.target.checked)}
                                    className="peer sr-only"
                                />
                                <span className="absolute inset-0 rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] transition-colors peer-checked:border-accent peer-checked:bg-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
                                <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                            </label>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-xs">
                            <span className="text-[var(--text-muted)]">{labels.company_access}</span>
                            <span className="font-semibold text-[var(--text-main)]">
                                {status.company_connections_enabled ? labels.enabled : labels.disabled}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
                <Metric
                    icon={Building2}
                    label={labels.connected_companies}
                    value={status.connected_companies}
                />
                <Metric
                    icon={UsersRound}
                    label={labels.pending_requests}
                    value={status.pending_ownership_requests}
                />
            </section>

            <section className="surface-glass-card overflow-hidden rounded-2xl">
                <div className="border-b border-[var(--border-soft)] px-5 py-4">
                    <h3 className="text-sm font-semibold tracking-tight">{labels.technical_details}</h3>
                </div>
                <dl className="divide-y divide-[var(--border-soft)]">
                    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem] sm:items-center">
                        <dt className="text-xs font-semibold text-[var(--text-muted)]">{labels.callback}</dt>
                        <dd className="min-w-0 break-all rounded-lg bg-[var(--bg-secondary)]/70 px-3 py-2 font-mono text-xs text-[var(--text-main)]">
                            {status.redirect_uri}
                        </dd>
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon-sm"
                            className="rounded-[6px]"
                            onClick={onCopyCallback}
                            title={labels.copy_callback}
                            aria-label={labels.copy_callback}
                        >
                            <Copy />
                        </Button>
                    </div>
                    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                        <dt className="flex items-center gap-2.5 text-xs font-semibold text-[var(--text-muted)]">
                            <BrandIconWell icon={Clock3} size="sm" />
                            {labels.timezone}
                        </dt>
                        <dd className="text-sm font-medium">{status.timezone}</dd>
                    </div>
                </dl>
            </section>
        </div>
    );
}
