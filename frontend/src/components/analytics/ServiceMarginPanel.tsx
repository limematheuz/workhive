"use client";

import * as React from "react";
import { ChartNoAxesCombined, CircleDollarSign, HandCoins, Loader2, ReceiptText } from "lucide-react";

import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { SummaryMetricCard, SummaryMetricGrid, type SummaryMetricTone } from "@/components/ui/summary-metric-card";
import { formatCurrency } from "@/lib/format";
import {
    classifyReadError,
    getReadRecoveryMessage,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
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
    const [errorKind, setErrorKind] = React.useState<ReadErrorKind | null>(null);
    const requestIdRef = React.useRef(0);
    const loadedServiceRef = React.useRef<number | null>(null);

    const load = React.useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        if (loadedServiceRef.current !== serviceCatalogVersionId) {
            setMargin(null);
        }
        setErrorKind(null);
        try {
            const next = await ServiceMarginService.get(serviceCatalogVersionId);
            if (requestId !== requestIdRef.current) return;
            loadedServiceRef.current = serviceCatalogVersionId;
            setMargin(next);
            setErrorKind(null);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(error);
            if (kind === "denied" || loadedServiceRef.current !== serviceCatalogVersionId) {
                loadedServiceRef.current = null;
                setMargin(null);
            }
            setErrorKind(kind);
        } finally {
            setLoading((current) => (requestId === requestIdRef.current ? false : current));
        }
    }, [serviceCatalogVersionId]);

    const syncLoad = React.useEffectEvent(() => {
        void load();
    });

    React.useEffect(() => {
        const timer = window.setTimeout(() => syncLoad(), 0);
        return () => window.clearTimeout(timer);
    }, [serviceCatalogVersionId]);

    const errorMessage = getReadRecoveryMessage(errorKind, {
        unavailable: copy.operational_margin_service_error_load,
        denied: copy.operational_margin_service_error_denied,
    });

    if (loading && !margin) {
        return <div className="flex min-h-32 items-center justify-center text-[var(--text-muted)]"><Loader2 className="size-5 animate-spin" aria-label={copy.loading} /></div>;
    }
    if (!margin) {
        return errorKind && errorMessage ? (
            <div className="mt-5">
                <ReadRecoveryBanner
                    kind={errorKind}
                    message={errorMessage}
                    retryLabel={copy.retry}
                    onRetry={shouldShowReadRetry(errorKind) ? () => void load() : undefined}
                    retrying={loading}
                />
            </div>
        ) : null;
    }

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
