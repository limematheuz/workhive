"use client";

import Link from "next/link";
import { Check, ChevronDown, CircleGauge, Sparkles } from "lucide-react";
import { useState } from "react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import type { Dictionary, Locale } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";
import type {
    BillingInterval,
    PublicPlan,
    PublicPlanEntitlement,
} from "@/services/billing.service";

type PlanCatalogProps = {
    plans: PublicPlan[];
    dictionary: Dictionary["subscription"];
    locale: Locale;
};

const PLAN_ORDER = ["basic", "medium", "top", "mega"] as const;
const FEATURE_PREVIEW_COUNT = 3;
const SUMMARY_CAPACITY_CODES = [
    "limits.internal_workers",
    "limits.internal_admins",
    "limits.teams",
] as const;

function entitlementLabel(
    item: PublicPlanEntitlement,
    labels: Record<string, string>,
): string {
    return labels[item.code] ?? "";
}

function featureEntitlements(plan: PublicPlan): PublicPlanEntitlement[] {
    return plan.entitlements
        .filter(
            (item) => item.value_type === "boolean" && item.value === true && item.code.startsWith("features."),
        )
        .sort((left, right) => left.code.localeCompare(right.code));
}

function capacityEntitlements(plan: PublicPlan): PublicPlanEntitlement[] {
    return plan.entitlements
        .filter(
            (item) => item.value_type === "integer" && typeof item.value === "number",
        )
        .sort((left, right) => left.code.localeCompare(right.code));
}

function formatCurrency(amountCents: number, locale: Locale): string {
    return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    }).format(amountCents / 100);
}

function planForCode(plans: PublicPlan[], code: string): PublicPlan | undefined {
    return plans.find((plan) => plan.code === code);
}

export function PlanCatalog({ plans, dictionary: t, locale }: PlanCatalogProps) {
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
    const labels = t.entitlements as Record<string, string>;
    const orderedPlans = PLAN_ORDER
        .map((code) => planForCode(plans, code))
        .filter((plan): plan is PublicPlan => Boolean(plan));

    return (
        <section aria-labelledby="plan-catalogue-title">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
                <span id="plan-catalogue-title" className="sr-only">{t.plans_title}</span>
                <span className="text-xs font-semibold text-[var(--text-muted)]">{t.billing_toggle_label}</span>
                <div className="w-full max-w-sm">
                    <PremiumTabs<BillingInterval>
                        className="w-full"
                        tabs={[
                            { id: "monthly", label: t.billing_intervals.monthly },
                            { id: "annual", label: t.billing_intervals.annual },
                        ]}
                        activeTab={billingInterval}
                        onChange={setBillingInterval}
                    />
                </div>
            </div>

            <div className="grid items-start grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                {orderedPlans.map((plan, index) => {
                    const previousPlan = index > 0 ? orderedPlans[index - 1] : undefined;
                    const features = featureEntitlements(plan);
                    const previousFeatureCodes = new Set(
                        previousPlan ? featureEntitlements(previousPlan).map((item) => item.code) : [],
                    );
                    const addedFeatures = previousPlan
                        ? features.filter((item) => !previousFeatureCodes.has(item.code))
                        : features;
                    const visibleFeatures = addedFeatures.slice(0, FEATURE_PREVIEW_COUNT);
                    const capacities = capacityEntitlements(plan);
                    const summaryCapacities = SUMMARY_CAPACITY_CODES
                        .map((code) => capacities.find((item) => item.code === code))
                        .filter((item): item is PublicPlanEntitlement => Boolean(item));
                    const selectedPrice = plan.prices.find(
                        (price) => price.billing_interval === billingInterval,
                    );
                    const monthlyPrice = plan.prices.find(
                        (price) => price.billing_interval === "monthly",
                    );
                    const annualSavings = billingInterval === "annual" && selectedPrice && monthlyPrice
                        ? monthlyPrice.amount_cents * 12 - selectedPrice.amount_cents
                        : 0;
                    const isRecommended = plan.code === "top";
                    const planName = t.plan_names[plan.code];

                    return (
                        <AuthGlassCard
                            key={plan.code}
                            className={cn(
                                "billing-surface self-start flex min-w-0 flex-col border-[var(--border-soft)] p-5 sm:p-6 xl:col-span-2",
                                index === 3 && "xl:col-start-2",
                                isRecommended && "border-accent/55 bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--glass-sheet-bg))] shadow-[0_18px_48px_color-mix(in_srgb,var(--accent-color)_16%,transparent)] ring-1 ring-accent/40",
                            )}
                        >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0 space-y-2">
                                    <h2 className="text-xl font-bold tracking-tight">{planName}</h2>
                                    <p className="min-h-10 text-sm leading-5 text-[var(--text-muted)]">
                                        {t.plan_descriptions[plan.code]}
                                    </p>
                                </div>
                                {isRecommended && (
                                    <Badge className="shrink-0 bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-accent">
                                        <Sparkles className="size-3" />
                                        {t.recommended}
                                    </Badge>
                                )}
                            </div>

                            <div className="mt-5 border-y border-[var(--border-soft)] py-4">
                                {selectedPrice ? (
                                    <>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                            {t.price_per_company}
                                        </p>
                                        <div className="flex items-end gap-1.5">
                                            <span className="text-4xl font-bold tracking-tight text-[var(--text-main)]">
                                                {formatCurrency(
                                                    billingInterval === "annual"
                                                        ? selectedPrice.amount_cents / 12
                                                        : selectedPrice.amount_cents,
                                                    locale,
                                                )}
                                            </span>
                                            <span className="pb-1 text-sm font-medium text-[var(--text-muted)]">
                                                {t.per_month}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="text-[var(--text-muted)]">{t.tax_exclusive}</span>
                                            {billingInterval === "annual" && (
                                                <>
                                                    <span className="text-[var(--text-muted)]">
                                                        {t.billed_annually.replace("{amount}", formatCurrency(selectedPrice.amount_cents, locale))}
                                                    </span>
                                                    {annualSavings > 0 && (
                                                        <Badge variant="outline" className="border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/10">
                                                            {t.save_annually.replace("{amount}", formatCurrency(annualSavings, locale))}
                                                        </Badge>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm font-semibold text-[var(--text-main)]">{t.price_on_request}</p>
                                )}
                            </div>

                            <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                    {previousPlan
                                        ? t.includes_previous.replace("{plan}", t.plan_names[previousPlan.code])
                                        : t.features_included}
                                </p>
                                <ul className="mt-3 space-y-2 text-sm text-[var(--text-main)]">
                                    {visibleFeatures.map((feature) => (
                                        <li key={feature.code} className="flex min-w-0 items-start gap-2">
                                            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                                            <span className="min-w-0">{entitlementLabel(feature, labels)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Collapsible className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/45">
                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-semibold text-accent hover:bg-accent/5">
                                        {t.view_all_features.replace("{count}", String(features.length))}
                                        <ChevronDown className="size-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden="true" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t border-[var(--border-soft)] px-3 py-3">
                                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                                            {features.map((feature) => (
                                                <li key={feature.code} className="flex items-start gap-2">
                                                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
                                                    {entitlementLabel(feature, labels)}
                                                </li>
                                            ))}
                                        </ul>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>

                            <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                    <CircleGauge className="size-4" aria-hidden="true" />
                                    {t.capacity}
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {summaryCapacities.map((item) => (
                                        <div key={item.code} className="min-w-0 rounded-xl bg-[var(--bg-secondary)]/60 px-2.5 py-2.5">
                                            <p className="text-lg font-bold leading-none text-[var(--text-main)]">{item.value}</p>
                                            <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">{entitlementLabel(item, labels)}</p>
                                        </div>
                                    ))}
                                </div>
                                <Collapsible className="mt-3">
                                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-xs font-semibold text-accent hover:underline">
                                        {t.view_all_capacities}
                                        <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden="true" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-3">
                                        <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                            {capacities.map((item) => (
                                                <li key={item.code} className="flex items-baseline justify-between gap-3">
                                                    <span>{entitlementLabel(item, labels)}</span>
                                                    <span className="font-semibold text-[var(--text-main)]">{item.value}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>

                            <div className="mt-auto pt-6">
                                {selectedPrice?.checkout_available ? (
                                    <Button asChild size="lg" className="w-full">
                                        <Link href={`/subscription/checkout?plan=${plan.code}&interval=${billingInterval}`}>
                                            {t.choose_plan.replace("{plan}", planName)}
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button asChild variant="secondary" size="lg" className="w-full">
                                        <Link href={`/contact?reason=plan-${plan.code}`}>{t.contact_sales}</Link>
                                    </Button>
                                )}
                            </div>
                        </AuthGlassCard>
                    );
                })}

                <AuthGlassCard className="billing-surface self-start flex min-w-0 flex-col border-dashed border-accent/35 bg-[color-mix(in_srgb,var(--accent-color)_7%,var(--glass-sheet-bg))] p-5 sm:p-6 xl:col-span-2">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                        <Sparkles className="size-5" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold tracking-tight">{t.custom_title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t.custom_body}</p>
                    <div className="mt-auto pt-6">
                        <Button asChild variant="secondary" size="lg" className="w-full">
                            <Link href="/contact?reason=plan-custom">{t.contact_sales}</Link>
                        </Button>
                    </div>
                </AuthGlassCard>
            </div>
        </section>
    );
}
