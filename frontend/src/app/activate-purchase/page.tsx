"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordCreationFields } from "@/components/auth/PasswordCreationFields";
import { authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { ApiResponseError } from "@/lib/api";
import { useDictionary } from "@/lib/dictionary-context";
import { isStrongPassword } from "@/lib/password-strength";
import { billingService } from "@/services/billing.service";

function activationErrorMessage(
    error: unknown,
    t: ReturnType<typeof useDictionary>["dict"]["subscription"],
): string {
    if (!(error instanceof ApiResponseError)) return t.activation_error;
    if (error.status === 404 || error.status === 410) return t.activation_invalid;
    if (error.status === 409) return t.activation_conflict;
    if (error.status === 429) return t.activation_rate_limited;
    return t.activation_error;
}

function ActivatePurchaseContent() {
    const searchParams = useSearchParams();
    const { locale, dict } = useDictionary();
    const t = dict.subscription;
    const [token] = useState(() => searchParams.get("token") ?? "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [activated, setActivated] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (token) {
            window.history.replaceState(null, "", "/activate-purchase");
        }
    }, [token]);

    const activate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setError(t.password_mismatch);
            return;
        }
        if (!isStrongPassword(password)) {
            setError(t.activation_error);
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            await billingService.activateCompanyPurchase(token, password);
            setActivated(true);
        } catch (activationError) {
            setError(activationErrorMessage(activationError, t));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell contentClassName="my-auto w-full max-w-xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-6 sm:p-8">
                {activated ? (
                    <div className="py-3 text-center">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                            <CheckCircle2 className="size-7" aria-hidden="true" />
                        </div>
                        <h1 className="mt-5 text-2xl font-bold tracking-tight">{t.activation_success_title}</h1>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t.activation_success_body}</p>
                        <Button asChild size="lg" className="mt-7">
                            <Link href="/login">{t.activation_login}</Link>
                        </Button>
                    </div>
                ) : !token ? (
                    <div className="py-6 text-center">
                        <KeyRound className="mx-auto size-9 text-accent" aria-hidden="true" />
                        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{t.activation_invalid}</p>
                        <Button asChild variant="secondary" className="mt-5">
                            <Link href="/contact?reason=plan-custom">{t.contact_sales}</Link>
                        </Button>
                    </div>
                ) : (
                    <form className="space-y-5" onSubmit={(event) => void activate(event)} autoComplete="off">
                        <div>
                            <div className="flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                                <KeyRound className="size-5" aria-hidden="true" />
                            </div>
                            <h1 className="mt-4 text-2xl font-bold tracking-tight">{t.activation_title}</h1>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{t.activation_body}</p>
                        </div>
                        <PasswordCreationFields
                            locale={locale}
                            password={password}
                            confirmPassword={confirmPassword}
                            onPasswordChange={setPassword}
                            onConfirmPasswordChange={setConfirmPassword}
                            idPrefix="paid-company-activation"
                            showLegal={false}
                        />
                        {error && <p role="alert" className={authAlertClass("error")}>{error}</p>}
                        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                            {submitting && <LoaderCircle className="size-4 animate-spin" />}
                            {submitting ? t.activation_creating : t.activation_submit}
                        </Button>
                    </form>
                )}
            </AuthGlassCard>
        </AuthShell>
    );
}

export default function ActivatePurchasePage() {
    return (
        <Suspense
            fallback={
                <AuthShell contentClassName="my-auto w-full max-w-xl">
                    <AuthGlassCard className="billing-surface flex min-h-48 items-center justify-center border-[var(--border-soft)] text-accent">
                        <LoaderCircle className="size-5 animate-spin" aria-label="Loading" />
                    </AuthGlassCard>
                </AuthShell>
            }
        >
            <ActivatePurchaseContent />
        </Suspense>
    );
}
