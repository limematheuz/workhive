import {
    Building2,
    Clock3,
    CloudCog,
    Copy,
    ExternalLink,
    RefreshCw,
    UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { PageHeader } from "@/components/ui/page-header";
import type { PlatformCalendarStatus } from "@/services/calendar.service";
import { PlatformCalendarStatusCard } from "./PlatformCalendarStatusCard";

export type PlatformCalendarLabels = {
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
    status_column: string;
    detail_column: string;
    value_column: string;
};

type PlatformCalendarOverviewProps = {
    status: PlatformCalendarStatus;
    labels: PlatformCalendarLabels;
    saving: boolean;
    onToggle: (enabled: boolean) => void;
    onRefresh: () => void;
    onCopyCallback: () => void;
};

type DetailItem = {
    key: string;
    label: string;
    value: string;
    copyable?: boolean;
    icon?: ComponentType<{ className?: string }>;
};

const DETAIL_GRID = "grid-cols-[minmax(9rem,.9fr)_minmax(12rem,1.6fr)_3rem]";

function Metric({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
}) {
    return (
        <article className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-main)]">
                        {value}
                    </p>
                </div>
                <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                    aria-hidden="true"
                >
                    <Icon className="h-4 w-4" />
                </span>
            </div>
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
    const detailItems: DetailItem[] = [
        {
            key: "callback",
            label: labels.callback,
            value: status.redirect_uri,
            copyable: true,
        },
        {
            key: "timezone",
            label: labels.timezone,
            value: status.timezone,
            icon: Clock3,
        },
    ];

    const detailColumn = labels.detail_column;
    const valueColumn = labels.value_column;

    return (
        <div className="mx-auto max-w-6xl space-y-4 px-[3%] py-6 text-[var(--text-main)] md:p-8">
            <PageHeader
                icon={CloudCog}
                title={labels.title}
                subtitle={labels.subtitle}
                titleAs="h2"
                className="mb-0"
                actions={(
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={onRefresh}
                            title={labels.refresh}
                            aria-label={labels.refresh}
                        >
                            <RefreshCw />
                        </Button>
                        <Button asChild>
                            <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink />
                                {labels.open_google_cloud}
                            </a>
                        </Button>
                    </>
                )}
            />

            <PlatformCalendarStatusCard status={status} labels={labels} saving={saving} onToggle={onToggle} />

            <section className="grid gap-2.5 sm:grid-cols-2">
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

            <DataListTable
                items={detailItems}
                getRowKey={(item) => item.key}
                gridClassName={DETAIL_GRID}
                desktopFrom="md"
                header={{
                    title: labels.technical_details,
                }}
                columns={[
                    { key: "label", label: detailColumn },
                    { key: "value", label: valueColumn },
                    { key: "actions", label: "", className: "text-right" },
                ]}
                renderCompactRow={(item) => {
                    const Icon = item.icon;
                    return (
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                                    {item.label}
                                </p>
                                <p className={`mt-1 break-all text-xs text-[var(--text-main)] ${item.copyable ? "font-mono" : ""}`}>
                                    {item.value}
                                </p>
                            </div>
                            {item.copyable && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onCopyCallback}
                                    title={labels.copy_callback}
                                    aria-label={labels.copy_callback}
                                >
                                    <Copy />
                                </Button>
                            )}
                        </div>
                    );
                }}
                renderDesktopRow={(item) => {
                    const Icon = item.icon;
                    return (
                        <>
                            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                                {item.label}
                            </p>
                            <p className={`min-w-0 break-all text-xs text-[var(--text-main)] ${item.copyable ? "font-mono" : "text-sm"}`}>
                                {item.value}
                            </p>
                            <div className="flex justify-end">
                                {item.copyable ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={onCopyCallback}
                                        title={labels.copy_callback}
                                        aria-label={labels.copy_callback}
                                    >
                                        <Copy />
                                    </Button>
                                ) : null}
                            </div>
                        </>
                    );
                }}
            />
        </div>
    );
}
