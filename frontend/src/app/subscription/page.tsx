"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Crown, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth.service";

export default function SubscriptionPage() {
    const { dict } = useDictionary();
    const t = dict.auth;
    const [hasSession, setHasSession] = useState(false);

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

    const plans = [
        {
            id: "trial" as const,
            name: t.plan_trial_name,
            price: t.plan_trial_price,
            period: "",
            desc: t.plan_trial_desc,
            icon: Shield,
            btnText: t.start_trial,
            link: "/contact?reason=trial",
            popular: false,
            features: t.plan_trial_features,
            tag: t.trial_tag,
        },
        {
            id: "pro" as const,
            name: t.plan_pro_name,
            price: t.plan_pro_price,
            period: t.plan_pro_period,
            desc: t.plan_pro_desc,
            icon: Sparkles,
            btnText: t.select_plan,
            link: "/subscription/checkout?plan=pro",
            popular: true,
            features: t.plan_pro_features,
            tag: undefined,
        },
        {
            id: "lifetime" as const,
            name: t.plan_lifetime_name,
            price: t.plan_lifetime_price,
            period: t.plan_lifetime_period,
            desc: t.plan_lifetime_desc,
            icon: Crown,
            btnText: t.select_lifetime,
            link: "/subscription/checkout?plan=lifetime",
            popular: false,
            features: t.plan_lifetime_features,
            tag: t.lifetime_tag,
        },
    ];

    return (
        <AuthShell
            wide
            showFooter={false}
            contentClassName="my-auto max-w-7xl py-6"
        >
            <Link
                href={hasSession ? "/dashboard" : "/login"}
                className="group mb-6 inline-flex w-fit items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {hasSession ? t.back_to_dashboard : t.back_to_login}
            </Link>

            <div className="mx-auto mb-8 max-w-3xl text-center lg:mb-10">
                <h1 className="mb-2 text-3xl font-bold tracking-tight lg:text-4xl">
                    {t.pricing_title}
                </h1>
                <p className="mb-4 text-sm text-[var(--text-muted)] lg:text-base">
                    {t.pricing_subtitle}
                </p>
                <Badge
                    variant="outline"
                    className="rounded-full border-accent/30 bg-accent/12 px-4 py-1 text-xs font-semibold text-accent"
                >
                    {t.pricing_badge}
                </Badge>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-5 overflow-visible pt-3 sm:gap-6 md:grid-cols-1 lg:grid-cols-3 lg:gap-5 xl:gap-6">
                {plans.map((plan) => {
                    const Icon = plan.icon;
                    const isPro = plan.id === "pro";
                    return (
                        <AuthGlassCard
                            key={plan.id}
                            className={cn(
                                "billing-surface relative flex flex-col justify-between overflow-visible p-5 sm:p-6 xl:p-7 ui-motion hover:-translate-y-1",
                                isPro
                                    ? "z-[1] border-accent/55 bg-[color-mix(in_srgb,var(--accent-color)_14%,var(--glass-sheet-bg))] shadow-[0_28px_70px_color-mix(in_srgb,var(--accent-color)_32%,transparent)] ring-2 ring-accent/60 lg:scale-[1.03]"
                                    : "border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--accent-color)_6%,var(--glass-sheet-bg))]",
                            )}
                        >
                            {plan.popular && (
                                <Badge
                                    className="absolute -top-3 right-5 z-20 gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-accent/35 hover:bg-accent"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {t.popular_tag}
                                </Badge>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-xl font-bold xl:text-2xl">{plan.name}</h2>
                                    <div
                                        className={cn(
                                            "rounded-2xl border p-2.5",
                                            isPro
                                                ? "border-accent/40 bg-accent/18 text-accent"
                                                : "border-accent/25 bg-accent/10 text-accent",
                                        )}
                                    >
                                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
                                    <span
                                        className={cn(
                                            "font-extrabold tracking-tight",
                                            isPro
                                                ? "text-4xl xl:text-5xl"
                                                : "text-3xl xl:text-4xl",
                                        )}
                                    >
                                        {plan.price}
                                    </span>
                                    {plan.period && (
                                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                                            {plan.period}
                                        </span>
                                    )}
                                    {plan.tag && (
                                        <Badge
                                            className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-accent/35 hover:bg-accent"
                                        >
                                            {plan.id === "trial" ? (
                                                <Shield className="h-3.5 w-3.5" />
                                            ) : (
                                                <Crown className="h-3.5 w-3.5" />
                                            )}
                                            {plan.tag}
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                                    {plan.desc}
                                </p>

                                <hr className="border-[var(--border-soft)]" />

                                <ul className="space-y-2">
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

                            <div className="mt-6">
                                <Button
                                    asChild
                                    size="lg"
                                    variant={isPro ? "default" : "secondary"}
                                    className={cn(
                                        "h-12 w-full rounded-2xl text-sm",
                                        isPro &&
                                            "border-accent bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-light",
                                    )}
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
