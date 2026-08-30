import Link from "next/link";
import { Check, CircleGauge, Sparkles } from "lucide-react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";
import type { PublicPlan, PublicPlanEntitlement } from "@/services/billing.service";

type PlanCatalogProps = {
    plans: PublicPlan[];
    dictionary: Dictionary["subscription"];
};

const FEATURE_PREVIEW_COUNT = 7;

function entitlementLabel(
    item: PublicPlanEntitlement,
    labels: Record<string, string>,
): string {
    return labels[item.code] ?? "";
}

function featureEntitlements(plan: PublicPlan): PublicPlanEntitlement[] {
    return plan.entitlements.filter(
        (item) => item.value_type === "boolean" && item.value === true && item.code.startsWith("features."),
    );
}

function capacityEntitlements(plan: PublicPlan): PublicPlanEntitlement[] {
    return plan.entitlements.filter(
        (item) => item.value_type === "integer" && typeof item.value === "number",
    );
}

function formatCapacity(template: string, value: number, label: string): string {
    return template.replace("{value}", String(value)).replace("{label}", label);
}

export function PlanCatalog({ plans, dictionary: t }: PlanCatalogProps) {
    const labels = t.entitlements as Record<string, string>;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
                const features = featureEntitlements(plan)
                    .map((item) => entitlementLabel(item, labels))
                    .filter(Boolean);
                const capacity = capacityEntitlements(plan)
                    .map((item) => ({
                        label: entitlementLabel(item, labels),
                        value: item.value as number,
                    }))
                    .filter((item) => Boolean(item.label));
                const isRecommended = plan.code === "top";
                const planName = t.plan_names[plan.code];

                return (
                    <AuthGlassCard
                        key={plan.code}
                        className={cn(
                            "billing-surface flex min-w-0 flex-col border-[var(--border-soft)] p-5 sm:p-6",
                            isRecommended && "border-accent/50 bg-[color-mix(in_srgb,var(--accent-color)_10%,var(--glass-sheet-bg))] ring-1 ring-accent/35",
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

                        <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                {t.features_included}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm text-[var(--text-main)]">
                                {features.slice(0, FEATURE_PREVIEW_COUNT).map((feature) => (
                                    <li key={feature} className="flex min-w-0 items-start gap-2">
                                        <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                                        <span className="min-w-0">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            {features.length > FEATURE_PREVIEW_COUNT && (
                                <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">
                                    {t.and_more.replace("{count}", String(features.length - FEATURE_PREVIEW_COUNT))}
                                </p>
                            )}
                        </div>

                        <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                                <CircleGauge className="size-4" aria-hidden="true" />
                                {t.capacity}
                            </div>
                            <ul className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
                                {capacity.map((item) => (
                                    <li key={item.label} className="flex items-baseline justify-between gap-3">
                                        <span className="min-w-0">{item.label}</span>
                                        <span className="shrink-0 font-semibold text-[var(--text-main)]">
                                            {formatCapacity(t.up_to, item.value, "")
                                                .replace(/\s+$/, "")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-auto pt-6">
                            {plan.checkout_available ? (
                                <Button asChild size="lg" className="w-full">
                                    <Link href={`/subscription/checkout?plan=${plan.code}`}>
                                        {t.choose_plan.replace("{plan}", planName)}
                                    </Link>
                                </Button>
                            ) : (
                                <Button size="lg" className="w-full" disabled>
                                    {t.checkout_unavailable}
                                </Button>
                            )}
                        </div>
                    </AuthGlassCard>
                );
            })}

            <AuthGlassCard className="billing-surface flex min-w-0 flex-col border-dashed border-accent/35 bg-[color-mix(in_srgb,var(--accent-color)_6%,var(--glass-sheet-bg))] p-5 sm:p-6">
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
    );
}
