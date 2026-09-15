"use client";

import * as React from "react";
import { ChartNoAxesCombined, CircleDollarSign, HandCoins, Loader2, ReceiptText } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid, type SummaryMetricTone } from "@/components/ui/summary-metric-card";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ServiceMarginService } from "@/services/service-margin.service";
import type { ServiceMargin } from "@/types/margin-forecast";

type ServiceMarginPanelProps = {
    serviceCatalogVersionId: number;
    copy: Record<string, string>;
};

function marginTone(value: number): SummaryMetricTone {
    return value >= 0 ? "positive" : "negative";
}

export function ServiceMarginPanel({ serviceCatalogVersionId, copy }: ServiceMarginPanelProps) {
    const [margin, setMargin] = React.useState<ServiceMargin | null>(null);
    const [loading, setLoading] = React.useState(true);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            setMargin(await ServiceMarginService.get(serviceCatalogVersionId));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.operational_margin_service_error_load));
        } finally {
            setLoading(false);
        }
    }, [copy.operational_margin_service_error_load, serviceCatalogVersionId]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    if (loading) {
        return <div className="flex min-h-32 items-center justify-center text-[var(--text-muted)]"><Loader2 className="size-5 animate-spin" aria-label={copy.loading} /></div>;
    }
    if (!margin) return null;

    return (
        <section className="border-b border-[var(--border-soft)] py-5" aria-label={copy.operational_margin_service_title}>
            <div className="flex min-w-0 gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent"><ChartNoAxesCombined className="size-4" aria-hidden="true" /></span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">{copy.operational_margin_service_title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.operational_margin_service_subtitle}</p>
                </div>
            </div>
            <SummaryMetricGrid className="mt-4" desktopColumns={4} aria-label={copy.operational_margin_service_title}>
                <SummaryMetricCard icon={ReceiptText} label={copy.operational_margin_actual_revenue} value={formatCurrency(margin.actual_revenue_base_amount)} />
                <SummaryMetricCard icon={HandCoins} label={copy.operational_margin_actual_labor} value={formatCurrency(margin.actual_labor_cost_base_amount)} />
                <SummaryMetricCard icon={CircleDollarSign} label={copy.operational_margin_service_known_cost} value={formatCurrency(margin.known_direct_cost_base_amount)} />
                <SummaryMetricCard icon={ChartNoAxesCombined} label={copy.operational_margin_service_known_margin} value={formatCurrency(margin.known_margin_base_amount)} valueTone={marginTone(margin.known_margin_base_amount)} />
            </SummaryMetricGrid>
        </section>
    );
}
