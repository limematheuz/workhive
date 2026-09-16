"use client";

import { ArrowDownRight, CircleAlert, CircleCheck, TrendingUp, UserRoundX, WalletCards } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDictionary } from "@/lib/dictionary-context";
import type { CommercialOverview } from "@/services/company-plan-access.service";

const euroFormatter = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });

type CommercialOverviewPanelProps = {
    overview: CommercialOverview | null;
    loading?: boolean;
};

export function CommercialOverviewPanel({ overview, loading = false }: CommercialOverviewPanelProps) {
    const { dict } = useDictionary();
    const text = dict.superadmin;
    const value = (amount: number | undefined) => loading ? "—" : String(amount ?? 0);
    const currency = (amountCents: number | undefined) => loading
        ? "—"
        : euroFormatter.format((amountCents ?? 0) / 100);
    const plans = overview?.plans.filter((plan) => (
        plan.active_subscriptions > 0
        || plan.trial_subscriptions > 0
        || plan.payment_attention_subscriptions > 0
        || plan.inactive_subscriptions > 0
    )) ?? [];

    return (
        <section className="space-y-3" aria-labelledby="commercial-overview-title">
            <div>
                <h2 id="commercial-overview-title" className="text-sm font-bold text-[var(--text-main)]">
                    {text.commercial_title}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{text.commercial_subtitle}</p>
            </div>
            <SummaryMetricGrid desktopColumns={6} aria-label={text.commercial_title}>
                <SummaryMetricCard icon={CircleCheck} label={text.metric_paid_subscriptions} value={value(overview?.active_subscriptions)} valueTone="positive" />
                <SummaryMetricCard icon={TrendingUp} label={text.metric_trial_subscriptions} value={value(overview?.trial_subscriptions)} />
                <SummaryMetricCard icon={CircleAlert} label={text.metric_payment_attention} value={value(overview?.payment_attention_subscriptions)} valueTone="negative" />
                <SummaryMetricCard icon={WalletCards} label={text.commercial_contracted_mrr} value={currency(overview?.contracted_mrr_cents)} valueTone="positive" />
                <SummaryMetricCard icon={CircleAlert} label={text.commercial_terms_missing} value={value(overview?.active_subscriptions_without_commercial_terms)} valueTone={overview?.active_subscriptions_without_commercial_terms ? "negative" : "default"} />
                <SummaryMetricCard icon={TrendingUp} label={text.metric_upgrades_30_days} value={value(overview?.upgrades_last_30_days)} />
                <SummaryMetricCard icon={UserRoundX} label={text.metric_churn_30_days} value={value(overview?.churned_last_30_days)} valueTone="negative" />
            </SummaryMetricGrid>
            {!loading && overview && !overview.revenue_measurement_available ? (
                <p className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                    {text.commercial_revenue_unavailable}
                </p>
            ) : null}
            {plans.length > 0 ? (
                <div className="billing-block overflow-hidden rounded-[18px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{text.commercial_plan}</TableHead>
                                <TableHead className="text-right">{text.metric_paid_subscriptions}</TableHead>
                                <TableHead className="text-right">{text.metric_trial_subscriptions}</TableHead>
                                <TableHead className="text-right">{text.metric_payment_attention}</TableHead>
                                <TableHead className="text-right">{text.commercial_inactive}</TableHead>
                                <TableHead className="text-right">{text.commercial_mrr}</TableHead>
                                <TableHead className="text-right">{text.commercial_terms_missing_short}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map((plan) => (
                                <TableRow key={plan.code}>
                                    <TableCell className="font-medium text-[var(--text-main)]">{plan.label}</TableCell>
                                    <TableCell className="text-right tabular-nums">{plan.active_subscriptions}</TableCell>
                                    <TableCell className="text-right tabular-nums">{plan.trial_subscriptions}</TableCell>
                                    <TableCell className="text-right tabular-nums">{plan.payment_attention_subscriptions}</TableCell>
                                    <TableCell className="text-right tabular-nums">{plan.inactive_subscriptions}</TableCell>
                                    <TableCell className="text-right tabular-nums">{currency(plan.contracted_mrr_cents)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{plan.subscriptions_without_commercial_terms}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : null}
            {!loading && overview ? <p className="text-xs text-[var(--text-muted)]">{text.commercial_mrr_note}</p> : null}
            {!loading && overview && overview.downgrades_last_30_days > 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><ArrowDownRight className="size-3.5" aria-hidden="true" />{text.commercial_downgrades_30_days}: {overview.downgrades_last_30_days}</p>
            ) : null}
        </section>
    );
}
