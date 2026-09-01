"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Crown, Shield, Sparkles } from "lucide-react";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { authService } from "@/services/auth.service";
import type { BillingPlan } from "@/services/billing.service";
import { useDictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "annual";

type PublicPlan = {
    id: "basic" | "medium" | "top" | "mega" | "custom";
    icon: typeof Shield;
    name: string;
    description: string;
    features: string[];
    monthlyPrice: number | null;
    annualPrice: number | null;
    capacity: Array<{ label: string; value: string }>;
    actionLabel: string;
    contactHref: string;
    checkoutPlan?: Extract<BillingPlan, "basic" | "medium" | "top" | "mega">;
    popular?: boolean;
    layoutClassName?: string;
};

function formatEuros(amount: number, locale: string): string {
    return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function SubscriptionPage() {
    const { dict, locale } = useDictionary();
    const t = dict.auth;
    const [hasSession, setHasSession] = useState(false);
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
    const checkoutEnabled = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED === "true";

    useEffect(() => {
        let cancelled = false;
        void authService.getMe()
            .then(() => {
                if (!cancelled) setHasSession(true);
            })
            .catch(() => {
                if (!cancelled) setHasSession(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const plans: PublicPlan[] = [
        {
            id: "basic",
            icon: Shield,
            name: t.plan_basic_name,
            description: t.plan_basic_desc,
            features: t.plan_basic_features,
            monthlyPrice: 29,
            annualPrice: 290,
            capacity: [
                { label: t.pricing_workers, value: "5" },
                { label: t.pricing_admins, value: "1" },
                { label: t.pricing_teams, value: "2" },
            ],
            actionLabel: t.pricing_request_access,
            contactHref: "/contact?reason=plan-base",
            checkoutPlan: "basic",
        },
        {
            id: "medium",
            icon: Sparkles,
            name: t.plan_medium_name,
            description: t.plan_medium_desc,
            features: t.plan_medium_features,
            monthlyPrice: 69,
            annualPrice: 690,
            capacity: [
                { label: t.pricing_workers, value: "25" },
                { label: t.pricing_admins, value: "3" },
                { label: t.pricing_teams, value: "10" },
            ],
            actionLabel: t.pricing_request_access,
            contactHref: "/contact?reason=plan-medio",
            checkoutPlan: "medium",
        },
        {
            id: "top",
            icon: Crown,
            name: t.plan_top_name,
            description: t.plan_top_desc,
            features: t.plan_top_features,
            monthlyPrice: 129,
            annualPrice: 1290,
            capacity: [
                { label: t.pricing_workers, value: "100" },
                { label: t.pricing_admins, value: "10" },
                { label: t.pricing_teams, value: "50" },
            ],
            actionLabel: t.pricing_request_access,
            contactHref: "/contact?reason=plan-top",
            checkoutPlan: "top",
            popular: true,
        },
        {
            id: "mega",
            icon: Crown,
            name: t.plan_enterprise_name,
            description: t.plan_enterprise_desc,
            features: t.plan_enterprise_features,
            monthlyPrice: 249,
            annualPrice: 2490,
            capacity: [
                { label: t.pricing_workers, value: "500" },
                { label: t.pricing_admins, value: "25" },
                { label: t.pricing_teams, value: "250" },
            ],
            actionLabel: t.pricing_talk_sales,
            contactHref: "/contact?reason=plan-empresarial",
            checkoutPlan: "mega",
            layoutClassName: "xl:col-start-2",
        },
        {
            id: "custom",
            icon: Sparkles,
            name: t.plan_custom_name,
            description: t.plan_custom_desc,
            features: t.plan_custom_features,
            monthlyPrice: null,
            annualPrice: null,
            capacity: [
                { label: t.pricing_workers, value: "—" },
                { label: t.pricing_admins, value: "—" },
                { label: t.pricing_teams, value: "—" },
            ],
            actionLabel: t.pricing_request_proposal,
            contactHref: "/contact?reason=plan-personalizado",
        },
    ];

    return (
        <AuthShell wide showFooter={false} contentClassName="py-6 sm:py-10">
            <div className="mx-auto max-w-6xl">
                <Link
                    href={hasSession ? "/dashboard" : "/login"}
                    className="group mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
                >
                    <span aria-hidden="true" className="text-base transition-transform group-hover:-translate-x-1">←</span>
                    {hasSession ? t.back_to_dashboard : t.back_to_login}
                </Link>

                <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
                    <Badge variant="outline" className="rounded-full border-accent/30 bg-accent/12 px-4 py-1 text-xs font-semibold text-accent">
                        {t.pricing_badge}
                    </Badge>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                        {t.pricing_title}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)] sm:text-base">
                        {t.pricing_subtitle}
                    </p>
                    <div className="mx-auto mt-5 max-w-xs">
                        <PremiumTabs
                            activeTab={billingInterval}
                            onChange={setBillingInterval}
                            tabs={[
                                { id: "monthly", label: t.pricing_monthly },
                                { id: "annual", label: t.pricing_annual },
                            ]}
                        />
                    </div>
                    {billingInterval === "annual" && (
                        <p className="mt-3 text-xs font-semibold text-accent">{t.pricing_annual_saving}</p>
                    )}
                </header>

                <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-6 xl:gap-6">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.annualPrice;
                        const period = billingInterval === "monthly" ? t.pricing_per_month : t.pricing_per_year;
                        const isCustom = price === null;
                        const checkoutHref = plan.checkoutPlan
                            ? `/subscription/checkout?plan=${plan.checkoutPlan}&interval=${billingInterval}`
                            : null;
                        const actionHref = checkoutEnabled && checkoutHref ? checkoutHref : plan.contactHref;
                        const actionLabel = checkoutEnabled && checkoutHref
                            ? t.pricing_choose_plan
                            : plan.actionLabel;

                        return (
                            <AuthGlassCard
                                key={plan.id}
                                className={cn(
                                    "billing-surface relative flex min-h-full flex-col overflow-visible p-5 sm:p-6 xl:col-span-2",
                                    plan.layoutClassName,
                                    plan.popular
                                        ? "z-[1] border-accent/55 bg-[color-mix(in_srgb,var(--accent-color)_14%,var(--glass-sheet-bg))] shadow-[0_28px_70px_color-mix(in_srgb,var(--accent-color)_25%,transparent)] ring-2 ring-accent/60"
                                        : isCustom
                                          ? "border-dashed border-accent/45 bg-[color-mix(in_srgb,var(--accent-color)_8%,var(--glass-sheet-bg))]"
                                          : "border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--accent-color)_5%,var(--glass-sheet-bg))]",
                                )}
                            >
                                {plan.popular && (
                                    <Badge className="absolute -top-3 right-5 gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-accent/35 hover:bg-accent">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {t.popular_tag}
                                    </Badge>
                                )}

                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold tracking-tight">{plan.name}</h2>
                                        <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--text-muted)]">{plan.description}</p>
                                    </div>
                                    <div className="shrink-0 rounded-2xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
                                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                                    </div>
                                </div>

                                <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/8 px-4 py-3">
                                    {isCustom ? (
                                        <p className="text-3xl font-extrabold tracking-tight">{locale === "es" ? "A medida" : "Tailored"}</p>
                                    ) : (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-extrabold tracking-tight">{formatEuros(price, locale)}</span>
                                            <span className="text-sm font-semibold text-[var(--text-muted)]">{period}</span>
                                        </div>
                                    )}
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">{isCustom ? t.pricing_request_proposal : t.pricing_badge}</p>
                                </div>

                                <section className="mt-5 border-t border-[var(--border-soft)] pt-5">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">{t.pricing_features}</h3>
                                    <ul className="mt-3 space-y-2.5">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2 text-sm text-[var(--text-main)]">
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section className="mt-5 border-t border-[var(--border-soft)] pt-5">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">{t.pricing_capacity}</h3>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {plan.capacity.map((item) => (
                                            <div key={item.label} className="rounded-xl bg-[var(--bg-tertiary)]/55 px-2.5 py-3">
                                                <p className="text-xl font-extrabold tracking-tight">{item.value}</p>
                                                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--text-muted)]">{item.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{isCustom ? t.plan_custom_desc : t.pricing_limits_note}</p>
                                </section>

                                <Button asChild size="lg" variant={plan.popular ? "default" : "secondary"} className={cn("mt-6 h-12 w-full rounded-xl", plan.popular && "border-accent bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-light")}>
                                    <Link href={actionHref}>{actionLabel}</Link>
                                </Button>
                            </AuthGlassCard>
                        );
                    })}
                </div>

                <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-6 text-[var(--text-muted)]">
                    {checkoutEnabled ? t.pricing_checkout_note : t.pricing_launch_note}
                </p>
            </div>
        </AuthShell>
    );
}
