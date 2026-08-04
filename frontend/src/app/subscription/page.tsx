"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Shield, Sparkles } from "lucide-react";

const planBadgeClass =
    "inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-accent/35";

export default function SubscriptionPage() {
    const { dict } = useDictionary();
    const t = dict.auth;

    const plans = [
        {
            id: "trial",
            name: t.plan_trial_name,
            price: t.plan_trial_price,
            period: "",
            desc: t.plan_trial_desc,
            icon: Shield,
            btnText: t.start_trial,
            link: "/contact?reason=trial",
            popular: false,
            features: t.plan_trial_features,
        },
        {
            id: "pro",
            name: t.plan_pro_name,
            price: t.plan_pro_price,
            period: t.plan_pro_period,
            desc: t.plan_pro_desc,
            icon: Sparkles,
            btnText: t.select_plan,
            link: "/subscription/checkout?plan=pro",
            popular: true,
            features: t.plan_pro_features,
        },
    ] as const;

    return (
        <AuthShell wide showFooter={false} contentClassName="my-auto py-6">
            <Link
                href="/login"
                className="group mb-6 inline-flex w-fit items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {t.back_to_login}
            </Link>

            <div className="mx-auto mb-10 max-w-2xl text-center">
                <h1 className="mb-2 text-3xl font-bold tracking-tight lg:text-4xl">
                    {t.pricing_title}
                </h1>
                <p className="mb-4 text-sm text-[var(--text-muted)] lg:text-base">
                    {t.pricing_subtitle}
                </p>
                <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/12 px-4 py-1 text-xs font-semibold text-accent">
                    {t.pricing_badge}
                </span>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-8 overflow-visible pt-3 md:grid-cols-2 lg:gap-10">
                {plans.map((plan) => {
                    const Icon = plan.icon;
                    return (
                        <AuthGlassCard
                            key={plan.id}
                            className={`relative flex flex-col justify-between overflow-visible p-6 xl:p-8 ui-motion hover:-translate-y-1 ${
                                plan.popular
                                    ? "border-accent/55 bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--glass-sheet-bg))] shadow-[0_28px_70px_color-mix(in_srgb,var(--accent-color)_32%,transparent)] ring-2 ring-accent/60"
                                    : ""
                            }`}
                        >
                            {plan.popular && (
                                <span className={`absolute -top-3 right-5 z-20 ${planBadgeClass}`}>
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {t.popular_tag}
                                </span>
                            )}

                            <div className="space-y-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-xl font-bold xl:text-2xl">{plan.name}</h2>
                                    <div className="rounded-2xl border border-accent/30 bg-accent/12 p-2.5 text-accent">
                                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-4xl font-extrabold tracking-tight xl:text-5xl">
                                        {plan.price}
                                    </span>
                                    {plan.period && (
                                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                                            {plan.period}
                                        </span>
                                    )}
                                    {plan.id === "trial" && (
                                        <span className={planBadgeClass}>
                                            <Shield className="h-3.5 w-3.5" />
                                            {t.trial_tag}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                                    {plan.desc}
                                </p>

                                <hr className="border-[var(--border-soft)]" />

                                <ul className="space-y-2.5">
                                    {plan.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                                        >
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                            <span className="leading-snug">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-8">
                                <Button
                                    asChild
                                    size="lg"
                                    variant={plan.popular ? "default" : "secondary"}
                                    className={`h-12 w-full rounded-2xl text-sm ${
                                        plan.popular
                                            ? "border-accent bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-light"
                                            : ""
                                    }`}
                                >
                                    <Link href={plan.link}>{plan.btnText}</Link>
                                </Button>
                            </div>
                        </AuthGlassCard>
                    );
                })}
            </div>
        </AuthShell>
    );
}
