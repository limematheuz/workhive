"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { PlanCatalog } from "@/components/subscription/PlanCatalog";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";
import { authService } from "@/services/auth.service";
import { billingService, type PublicPlan } from "@/services/billing.service";

type LoadState = "loading" | "ready" | "error";

export default function SubscriptionPage() {
    const { dict, locale } = useDictionary();
    const t = dict.subscription;
    const [plans, setPlans] = useState<PublicPlan[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [hasSession, setHasSession] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let active = true;

        void authService.getMe()
            .then(() => {
                if (active) setHasSession(true);
            })
            .catch(() => {
                if (active) setHasSession(false);
            });

        void billingService.listPublicPlans()
            .then((availablePlans) => {
                if (!active) return;
                setPlans(availablePlans);
                setLoadState("ready");
            })
            .catch(() => {
                if (active) setLoadState("error");
            });

        return () => {
            active = false;
        };
    }, [reloadToken]);

    return (
        <AuthShell wide contentClassName="my-auto max-w-7xl py-6 sm:py-10">
            <Link
                href={hasSession ? "/dashboard" : "/login"}
                className="group mb-6 inline-flex min-h-11 w-fit items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
            >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                {hasSession ? t.back_to_dashboard : t.back}
            </Link>

            <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <ShieldCheck className="size-6" aria-hidden="true" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.plans_title}</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)] sm:text-base">{t.plans_subtitle}</p>
            </header>

            {loadState === "loading" ? (
                <AuthGlassCard className="billing-surface flex min-h-48 items-center justify-center gap-3 border-[var(--border-soft)] text-sm text-[var(--text-muted)]">
                    <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden="true" />
                    {t.plans_loading}
                </AuthGlassCard>
            ) : loadState === "error" ? (
                <AuthGlassCard className="billing-surface mx-auto max-w-xl border-[var(--border-soft)] text-center">
                    <CircleAlert className="mx-auto size-8 text-accent" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{t.plans_error}</p>
                    <Button
                        type="button"
                        variant="secondary"
                        className="mt-5"
                        onClick={() => {
                            setLoadState("loading");
                            setReloadToken((current) => current + 1);
                        }}
                    >
                        {t.retry}
                    </Button>
                </AuthGlassCard>
            ) : (
                <PlanCatalog plans={plans} dictionary={t} locale={locale} />
            )}

            <AuthGlassCard className="billing-surface mx-auto mt-6 max-w-3xl border-[var(--border-soft)] p-5 text-center sm:p-6">
                <h2 className="text-lg font-bold tracking-tight">{t.existing_account_title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t.existing_account_body}</p>
                <Button asChild variant="secondary" className="mt-4">
                    <Link href={hasSession ? "/dashboard/profile" : "/login"}>
                        {hasSession ? t.back_to_dashboard : dict.auth.sign_in}
                    </Link>
                </Button>
            </AuthGlassCard>
        </AuthShell>
    );
}
