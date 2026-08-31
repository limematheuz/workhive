"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, LoaderCircle, LockKeyhole } from "lucide-react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api";
import { useDictionary } from "@/lib/dictionary-context";
import { getTrustedExternalUrl } from "@/lib/external-navigation";
import { authService } from "@/services/auth.service";
import {
    billingService,
    isPublicPlanCode,
    type BillingInterval,
    type CompanyPurchaseCheckoutInput,
    type PublicPlanCode,
} from "@/services/billing.service";

type SessionState = "checking" | "anonymous" | "existing";
type TextField = Exclude<
    keyof CompanyPurchaseCheckoutInput,
    "plan" | "billing_interval" | "accept_terms" | "accept_privacy" | "marketing_consent"
>;

function isBillingInterval(value: string | null): value is BillingInterval {
    return value === "monthly" || value === "annual";
}

function getCheckoutErrorMessage(error: unknown, t: ReturnType<typeof useDictionary>["dict"]["subscription"]): string {
    if (!(error instanceof ApiResponseError)) return t.checkout_error;
    if (error.status === 409) return t.checkout_conflict;
    if (error.status === 422) return t.checkout_validation_error;
    if (error.status === 429) return t.checkout_rate_limited;
    if (error.status === 401 || error.status === 403) return t.checkout_admin_required;
    return t.checkout_error;
}

function EmptyPlanState() {
    const { dict } = useDictionary();
    const t = dict.subscription;

    return (
        <AuthShell contentClassName="my-auto w-full max-w-xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] text-center">
                <LockKeyhole className="mx-auto size-8 text-accent" aria-hidden="true" />
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{t.invalid_plan}</p>
                <Button asChild variant="secondary" className="mt-5">
                    <Link href="/subscription">{t.back}</Link>
                </Button>
            </AuthGlassCard>
        </AuthShell>
    );
}

function CheckoutContent() {
    const searchParams = useSearchParams();
    const { dict } = useDictionary();
    const t = dict.subscription;
    const requestedPlan = searchParams.get("plan");
    const requestedInterval = searchParams.get("interval");
    const plan: PublicPlanCode | null = isPublicPlanCode(requestedPlan) ? requestedPlan : null;
    const billingInterval: BillingInterval = isBillingInterval(requestedInterval)
        ? requestedInterval
        : "monthly";
    const [sessionState, setSessionState] = useState<SessionState>("checking");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState<CompanyPurchaseCheckoutInput>(() => ({
        plan: plan ?? "basic",
        billing_interval: billingInterval,
        company_name: "",
        tax_id: "",
        address: "",
        postal_code: "",
        city: "",
        province: "",
        phone: "",
        company_email: "",
        owner_full_name: "",
        owner_email: "",
        accept_terms: false,
        accept_privacy: false,
        marketing_consent: false,
    }));

    useEffect(() => {
        let active = true;
        void authService.getMe()
            .then(() => {
                if (active) setSessionState("existing");
            })
            .catch(() => {
                if (active) setSessionState("anonymous");
            });
        return () => {
            active = false;
        };
    }, []);

    if (!plan) return <EmptyPlanState />;

    const updateField = (field: TextField, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const redirectToStripe = (checkoutUrl: string) => {
        window.location.assign(getTrustedExternalUrl(checkoutUrl));
    };

    const startExistingCheckout = async () => {
        setError("");
        setSubmitting(true);
        try {
            redirectToStripe(await billingService.createCheckout(plan, billingInterval));
        } catch (checkoutError) {
            setError(getCheckoutErrorMessage(checkoutError, t));
            setSubmitting(false);
        }
    };

    const startCompanyPurchase = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.accept_terms || !form.accept_privacy) {
            setError(t.legal_required);
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            const checkoutUrl = await billingService.createCompanyPurchaseCheckout({
                ...form,
                plan,
                billing_interval: billingInterval,
                postal_code: form.postal_code || undefined,
                city: form.city || undefined,
                province: form.province || undefined,
            });
            redirectToStripe(checkoutUrl);
        } catch (checkoutError) {
            setError(getCheckoutErrorMessage(checkoutError, t));
            setSubmitting(false);
        }
    };

    const planName = t.plan_names[plan];

    return (
        <AuthShell wide contentClassName="my-auto w-full max-w-4xl py-6 sm:py-10">
            <Link
                href="/subscription"
                className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t.back}
            </Link>

            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-5 sm:p-7">
                <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                            <Building2 className="size-5" aria-hidden="true" />
                        </div>
                        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{t.checkout_title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{t.checkout_intro}</p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">
                        <span className="mr-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{t.selected_plan}</span>
                        {planName} · {t.billing_intervals[billingInterval]}
                    </div>
                </div>

                {sessionState === "checking" ? (
                    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
                        <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden="true" />
                        {t.plans_loading}
                    </div>
                ) : sessionState === "existing" ? (
                    <ExistingCompanyCheckout
                        submitting={submitting}
                        error={error}
                        text={t}
                        onSubmit={() => void startExistingCheckout()}
                    />
                ) : (
                    <CompanyPurchaseForm
                        form={form}
                        submitting={submitting}
                        error={error}
                        text={t}
                        onTextChange={updateField}
                        onBooleanChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
                        onSubmit={(event) => void startCompanyPurchase(event)}
                    />
                )}
            </AuthGlassCard>
        </AuthShell>
    );
}

function ExistingCompanyCheckout({
    submitting,
    error,
    text: t,
    onSubmit,
}: {
    submitting: boolean;
    error: string;
    text: ReturnType<typeof useDictionary>["dict"]["subscription"];
    onSubmit: () => void;
}) {
    return (
        <div className="mx-auto max-w-2xl py-8 text-center sm:py-12">
            <LockKeyhole className="mx-auto size-9 text-accent" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold tracking-tight">{t.existing_checkout_title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t.existing_checkout_body}</p>
            {error && <p role="alert" className={`mt-5 ${authAlertClass("error")}`}>{error}</p>}
            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                <Button asChild variant="secondary" size="lg">
                    <Link href="/subscription">{t.cancel}</Link>
                </Button>
                <Button type="button" size="lg" disabled={submitting} onClick={onSubmit}>
                    {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                    {submitting ? t.redirecting : t.existing_checkout_action}
                </Button>
            </div>
        </div>
    );
}

function CompanyPurchaseForm({
    form,
    submitting,
    error,
    text: t,
    onTextChange,
    onBooleanChange,
    onSubmit,
}: {
    form: CompanyPurchaseCheckoutInput;
    submitting: boolean;
    error: string;
    text: ReturnType<typeof useDictionary>["dict"]["subscription"];
    onTextChange: (field: TextField, value: string) => void;
    onBooleanChange: (
        field: "accept_terms" | "accept_privacy" | "marketing_consent",
        value: boolean,
    ) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <form className="mt-6 space-y-7" onSubmit={onSubmit}>
            <fieldset className="space-y-4">
                <legend className="text-lg font-bold tracking-tight">{t.company_data}</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <CheckoutField id="company-name" label={t.company_name} value={form.company_name} onChange={(value) => onTextChange("company_name", value)} autoComplete="organization" className="sm:col-span-2" />
                    <CheckoutField id="tax-id" label={t.tax_id} value={form.tax_id} onChange={(value) => onTextChange("tax_id", value)} autoComplete="off" />
                    <CheckoutField id="company-phone" label={t.phone} value={form.phone} onChange={(value) => onTextChange("phone", value)} type="tel" inputMode="tel" autoComplete="tel" />
                    <CheckoutField id="company-email" label={t.company_email} value={form.company_email} onChange={(value) => onTextChange("company_email", value)} type="email" inputMode="email" autoComplete="email" className="sm:col-span-2" />
                    <CheckoutField id="company-address" label={t.address} value={form.address} onChange={(value) => onTextChange("address", value)} autoComplete="street-address" className="sm:col-span-2" />
                    <CheckoutField id="postal-code" label={t.postal_code} value={form.postal_code ?? ""} onChange={(value) => onTextChange("postal_code", value)} autoComplete="postal-code" required={false} />
                    <CheckoutField id="city" label={t.city} value={form.city ?? ""} onChange={(value) => onTextChange("city", value)} autoComplete="address-level2" required={false} />
                    <CheckoutField id="province" label={t.province} value={form.province ?? ""} onChange={(value) => onTextChange("province", value)} autoComplete="address-level1" required={false} className="sm:col-span-2" />
                </div>
            </fieldset>

            <fieldset className="border-t border-[var(--border-soft)] pt-6">
                <legend className="text-lg font-bold tracking-tight">{t.owner_data}</legend>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <CheckoutField id="owner-name" label={t.owner_name} value={form.owner_full_name} onChange={(value) => onTextChange("owner_full_name", value)} autoComplete="name" />
                    <CheckoutField id="owner-email" label={t.owner_email} value={form.owner_email} onChange={(value) => onTextChange("owner_email", value)} type="email" inputMode="email" autoComplete="email" />
                </div>
            </fieldset>

            <div className="space-y-3 border-t border-[var(--border-soft)] pt-6 text-sm leading-6 text-[var(--text-muted)]">
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="accept-terms"
                        checked={form.accept_terms}
                        onCheckedChange={(checked) => onBooleanChange("accept_terms", checked === true)}
                    />
                    <Label htmlFor="accept-terms" className="cursor-pointer font-normal leading-6">
                        {t.accept_terms_before} <Link href="/terms" target="_blank" className="text-accent underline underline-offset-2">{t.terms}</Link>
                    </Label>
                </div>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="accept-privacy"
                        checked={form.accept_privacy}
                        onCheckedChange={(checked) => onBooleanChange("accept_privacy", checked === true)}
                    />
                    <Label htmlFor="accept-privacy" className="cursor-pointer font-normal leading-6">
                        {t.and_privacy} <Link href="/privacy" target="_blank" className="text-accent underline underline-offset-2">{t.privacy}</Link>
                    </Label>
                </div>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="marketing-consent"
                        checked={form.marketing_consent}
                        onCheckedChange={(checked) => onBooleanChange("marketing_consent", checked === true)}
                    />
                    <Label htmlFor="marketing-consent" className="cursor-pointer font-normal leading-6">{t.marketing}</Label>
                </div>
            </div>

            {error && <p role="alert" className={authAlertClass("error")}>{error}</p>}

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-soft)] pt-6 sm:flex-row sm:justify-end">
                <Button asChild variant="secondary" size="lg">
                    <Link href="/subscription">{t.cancel}</Link>
                </Button>
                <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                    {submitting ? t.redirecting : t.continue_to_stripe}
                </Button>
            </div>
        </form>
    );
}

function CheckoutField({
    id,
    label,
    value,
    onChange,
    className,
    type = "text",
    required = true,
    ...inputProps
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    type?: "text" | "email" | "tel";
    required?: boolean;
} & Pick<React.ComponentProps<typeof Input>, "autoComplete" | "inputMode">) {
    return (
        <div className={className}>
            <Label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</Label>
            <Input
                {...inputProps}
                id={id}
                type={type}
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-2 h-11 rounded-xl"
            />
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense
            fallback={
                <AuthShell showFooter={false} contentClassName="my-auto w-full max-w-xl">
                    <AuthGlassCard className="billing-surface flex min-h-48 items-center justify-center gap-3 border-[var(--border-soft)] text-sm text-[var(--text-muted)]">
                        <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden="true" />
                    </AuthGlassCard>
                </AuthShell>
            }
        >
            <CheckoutContent />
        </Suspense>
    );
}
