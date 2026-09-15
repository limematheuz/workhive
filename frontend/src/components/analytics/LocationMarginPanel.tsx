"use client";

import * as React from "react";
import { ChartNoAxesCombined, Loader2 } from "lucide-react";

import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { LocationMarginService } from "@/services/location-margin.service";
import type { LocationMargin } from "@/types/margin-forecast";

type LocationMarginPanelProps = {
    locationId: number;
    copy: Record<string, string>;
};

function marginTone(value: number): string {
    return value >= 0
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-red-700 dark:text-red-300";
}

export function LocationMarginPanel({ locationId, copy }: LocationMarginPanelProps) {
    const [margin, setMargin] = React.useState<LocationMargin | null>(null);
    const [loading, setLoading] = React.useState(true);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            setMargin(await LocationMarginService.get(locationId));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.operational_margin_location_error_load));
        } finally {
            setLoading(false);
        }
    }, [copy.operational_margin_location_error_load, locationId]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    if (loading) {
        return <div className="flex min-h-32 items-center justify-center text-[var(--text-muted)]"><Loader2 className="size-5 animate-spin" aria-label={copy.loading} /></div>;
    }
    if (!margin) return null;

    return (
        <section className="border-b border-[var(--border-soft)] py-5" aria-label={copy.operational_margin_location_title}>
            <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent"><ChartNoAxesCombined className="size-4" aria-hidden="true" /></span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">{copy.operational_margin_location_title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.operational_margin_location_subtitle}</p>
                </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={copy.operational_margin_actual_revenue} value={margin.actual_revenue_base_amount} />
                <Metric label={copy.operational_margin_actual_cost} value={margin.actual_direct_cost_base_amount} />
                <Metric label={copy.operational_margin_actual_margin} value={margin.actual_margin_base_amount} tone={marginTone(margin.actual_margin_base_amount)} />
                <Metric label={copy.operational_margin_actual_labor} value={margin.actual_labor_cost_base_amount} />
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">{copy.operational_margin_actual_material}: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(margin.actual_material_cost_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">{copy.operational_margin_actual_expenses}: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(margin.actual_expense_cost_base_amount)}</span></p>
            </div>
        </section>
    );
}

function Metric({ label, value, tone = "text-[var(--text-main)]" }: { label: string; value: number; tone?: string }) {
    return <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className={`mt-1 font-mono text-sm font-semibold ${tone}`}>{formatCurrency(value)}</p></div>;
}
