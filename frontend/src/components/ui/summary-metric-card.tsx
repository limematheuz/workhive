import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { getTrendBadgePresentation } from "@/lib/metric-trend";

export type SummaryMetricTrend = {
    value: number;
    comparisonDirection?: "higher" | "lower";
};

export type SummaryMetricTone = "default" | "positive" | "negative";

type SummaryMetricGridProps = {
    children: ReactNode;
    /** Number of summary cards per row on wide screens. Mobile always uses two columns. */
    desktopColumns?: 3 | 4 | 5 | 6;
    className?: string;
    "aria-label"?: string;
};

const desktopGridClassName = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "md:grid-cols-3 xl:grid-cols-5",
    6: "md:grid-cols-3 xl:grid-cols-6",
} as const;

/**
 * Shared KPI layout: phone screens always keep two readable cards per row.
 * An odd final card deliberately stays one cell wide instead of stretching.
 */
export function SummaryMetricGrid({ children, desktopColumns = 4, className, "aria-label": ariaLabel }: SummaryMetricGridProps) {
    return (
        <section aria-label={ariaLabel} className={cn("wh-metric-grid grid grid-cols-2 gap-3", desktopGridClassName[desktopColumns], className)}>
            {children}
        </section>
    );
}

type SummaryMetricCardProps = {
    icon: LucideIcon;
    label: string;
    value: string;
    description?: string;
    trend?: SummaryMetricTrend;
    valueTone?: SummaryMetricTone;
    className?: string;
};

export function SummaryMetricCard({
    icon: Icon,
    label,
    value,
    description,
    trend,
    valueTone = "default",
    className = "",
}: SummaryMetricCardProps) {
    const valueToneClassName = valueTone === "positive"
        ? "text-[var(--status-active-text)]"
        : valueTone === "negative"
            ? "text-[var(--priority-high-text)]"
            : "text-accent";

    return (
        <article className={`billing-block summary-metric-card relative rounded-xl p-3 ${className}`}>
            <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="text-xs font-medium leading-snug text-[var(--text-muted)]">{label}</p>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <div className="min-w-0">
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className={`min-w-0 break-words text-xl font-semibold leading-tight tabular-nums ${valueToneClassName}`}>{value}</p>
                    {trend ? <SummaryMetricTrendBadge trend={trend} /> : null}
                </div>
                {description ? <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">{description}</p> : null}
            </div>
        </article>
    );
}

function SummaryMetricTrendBadge({ trend }: { trend: SummaryMetricTrend }) {
    const comparisonDirection = trend.comparisonDirection ?? "higher";
    const { value, tone } = getTrendBadgePresentation(trend.value, comparisonDirection);
    const TrendIcon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    const toneClassName = tone === "neutral"
        ? "border border-accent/20 bg-accent/10 text-accent"
        : tone === "positive"
            ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]"
            : "border border-[var(--priority-high-border)] bg-[var(--priority-high-bg)] text-[var(--priority-high-text)]";

    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${toneClassName}`}>
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {value > 0 ? "+" : ""}{value.toFixed(1)}%
        </span>
    );
}
