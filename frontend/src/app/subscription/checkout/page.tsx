"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";
import {
    billingService,
    type BillingInterval,
    type BillingPlan,
} from "@/services/billing.service";
import { getTrustedExternalUrl } from "@/lib/external-navigation";

type CheckoutPlan = "basic" | "medium" | "top" | "mega";

function CheckoutContent() {
    const searchParams = useSearchParams();
    const { dict } = useDictionary();
    const t = dict.auth;
    const requestedPlan = searchParams.get("plan");
    const plan: CheckoutPlan = ["basic", "medium", "top", "mega"].includes(requestedPlan ?? "")
        ? requestedPlan as CheckoutPlan
        : "basic";
    const requestedInterval = searchParams.get("interval");
    const billingInterval: BillingInterval = requestedInterval === "annual" ? "annual" : "monthly";
    const planName = {
        basic: t.plan_basic_name,
        medium: t.plan_medium_name,
        top: t.plan_top_name,
        mega: t.plan_enterprise_name,
    }[plan];
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [error, setError] = useState("");

    const startSecureCheckout = async () => {
        setError("");
        setIsRedirecting(true);
        try {
            const checkoutUrl = await billingService.createCheckout(plan as BillingPlan, billingInterval);
            window.location.assign(getTrustedExternalUrl(checkoutUrl));
        } catch (checkoutError) {
            setError(
                checkoutError instanceof Error ? checkoutError.message : t.checkout_error,
            );
            setIsRedirecting(false);
        }
    };

    return (
        <AuthShell showFooter={false} contentClassName="my-auto w-full max-w-2xl">
            <AuthGlassCard className="p-7 sm:p-10">
                <Link
                    href="/subscription"
                    className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t.checkout_back_plans}
                </Link>

                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                    <LockKeyhole className="h-7 w-7" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight">{t.checkout_title}</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {t.checkout_body.replace("{plan}", planName)}
                </p>

                {error && <div className={`mt-5 ${authAlertClass("error")}`}>{error}</div>}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button
                        type="button"
                        size="lg"
                        className="flex-1"
                        onClick={startSecureCheckout}
                        disabled={isRedirecting}
                    >
                        {isRedirecting ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <ExternalLink className="h-4 w-4" />
                        )}
                        {isRedirecting ? t.checkout_signing : t.checkout_continue}
                    </Button>
                    <Button asChild variant="secondary" size="lg">
                        <Link href="/login">{t.checkout_sign_in}</Link>
                    </Button>
                </div>
            </AuthGlassCard>
        </AuthShell>
    );
}

export default function CheckoutPage() {
    const { dict } = useDictionary();
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
                    {dict.auth.loading}
                </div>
            }
        >
            <CheckoutContent />
        </Suspense>
    );
}
