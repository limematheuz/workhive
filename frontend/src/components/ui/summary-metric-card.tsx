import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SummaryMetricTrend = {
    value: number;
    comparisonDirection?: "higher" | "lower";
};

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
    5: "xl:grid-cols-5",
    6: "xl:grid-cols-6",
} as const;

/**
 * Shared KPI layout: phone screens always keep two readable cards per row.
 * An odd final card deliberately stays one cell wide instead of stretching.
 */
export function SummaryMetricGrid({ children, desktopColumns = 4, className, "aria-label": ariaLabel }: SummaryMetricGridProps) {
    return (
        <section aria-label={ariaLabel} className={cn("grid grid-cols-2 gap-3", desktopGridClassName[desktopColumns], className)}>
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
    className?: string;
};

export function SummaryMetricCard({
    icon: Icon,
    label,
    value,
    description,
    trend,
    className = "",
}: SummaryMetricCardProps) {
    return (
        <article className={`billing-block rounded-[22px] p-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                </span>
                {trend ? <SummaryMetricTrendBadge trend={trend} /> : null}
            </div>
            <div className="mt-3 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">{label}</p>
                <p className="mt-1 font-mono text-xl font-semibold leading-tight text-[var(--text-main)] sm:text-2xl">{value}</p>
                {description ? <p className="mt-2 text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">{description}</p> : null}
            </div>
        </article>
    );
}

function SummaryMetricTrendBadge({ trend }: { trend: SummaryMetricTrend }) {
    const comparisonDirection = trend.comparisonDirection ?? "higher";
    const impact = comparisonDirection === "higher" ? trend.value : -trend.value;
    const rounded = Math.round(impact * 10) / 10;
    const TrendIcon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
    const toneClassName = rounded === 0
        ? "border border-accent/20 bg-accent/10 text-accent"
        : rounded > 0
            ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]"
            : "border border-red-500/20 bg-red-500/10 text-red-600";

    return (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${toneClassName}`}>
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {rounded > 0 ? "+" : ""}{rounded.toFixed(1)}%
        </span>
    );
}
