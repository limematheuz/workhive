"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, LockKeyhole } from "lucide-react";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { useDictionary } from "@/lib/dictionary-context";
import { billingService, BillingPlan } from "@/services/billing.service";
import { getTrustedExternalUrl } from "@/lib/external-navigation";

function CheckoutContent() {
    const searchParams = useSearchParams();
    const { locale } = useDictionary();
    const requestedPlan = searchParams.get("plan");
    const plan: BillingPlan = requestedPlan === "pro" ? "pro" : "business";
    const planName = plan === "pro" ? "Pro" : "Business";
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [error, setError] = useState("");

    const startSecureCheckout = async () => {
        setError("");
        setIsRedirecting(true);
        try {
            const checkoutUrl = await billingService.createCheckout(plan);
            window.location.assign(getTrustedExternalUrl(checkoutUrl));
        } catch (checkoutError) {
            setError(
                checkoutError instanceof Error
                    ? checkoutError.message
                    : "No se pudo iniciar el pago seguro"
            );
            setIsRedirecting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[var(--bg-primary)] px-4 py-8 text-[var(--text-main)]">
            <AuthTopControls showThemeToggle={false} />

            <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center">
                <div className="w-full rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-7 shadow-xl sm:p-10">
                    <Link
                        href="/subscription"
                        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {locale === "es" ? "Volver a planes" : "Back to plans"}
                    </Link>

                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <LockKeyhole className="h-7 w-7" />
                    </div>

                    <h1 className="text-3xl font-black">
                        {locale === "es" ? "Pago seguro" : "Secure checkout"}
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                        {locale === "es"
                            ? `El plan ${planName} se contrata en una página alojada por Stripe. Debes iniciar sesión como administrador de tu empresa. WorkHive no recibe ni almacena los datos de tu tarjeta.`
                            : `The ${planName} plan is purchased on a Stripe-hosted page. You must sign in as your company administrator. WorkHive never receives or stores your card details.`}
                    </p>

                    {error && (
                        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={startSecureCheckout}
                            disabled={isRedirecting}
                            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--text-main)] px-5 text-sm font-bold text-[var(--bg-primary)] disabled:cursor-wait disabled:opacity-60"
                        >
                            {isRedirecting ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <ExternalLink className="h-4 w-4" />
                            )}
                            {locale === "es" ? "Continuar a Stripe" : "Continue to Stripe"}
                        </button>
                        <Link
                            href="/login"
                            className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-5 text-sm font-bold"
                        >
                            {locale === "es" ? "Iniciar sesión" : "Sign in"}
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
            <CheckoutContent />
        </Suspense>
    );
}
