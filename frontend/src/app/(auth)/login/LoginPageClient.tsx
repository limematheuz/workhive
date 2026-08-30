"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { clearSessionCache } from "@/lib/auth";
import {
    getAuthErrorMessage,
    getAuthFormMessages,
    prepareLoginCredentials,
} from "@/lib/auth-forms";
import {
    loginStatusRedirectDelayMs,
    resolveLoginStatusPhrases,
} from "@/lib/login-status";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { LoginStatusFeedback } from "@/components/auth/LoginStatusFeedback";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-ui";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    LockKeyhole,
    Mail,
    ShieldCheck,
} from "lucide-react";
import { toast } from "@/lib/toast";

function GoogleGlyph({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

type LoginOutcome =
    | { kind: "idle" }
    | { kind: "error"; message: string }
    | { kind: "success" };

export default function LoginPageClient({ returnTo }: { returnTo: string }) {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const t = dict.auth;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<LoginOutcome>({ kind: "idle" });
    const [checkingExistingSession, setCheckingExistingSession] = useState(true);

    const successPhrases = resolveLoginStatusPhrases(
        "success",
        t.login_success_phrases,
        t.success_login_hint,
    );
    const failPhrases = resolveLoginStatusPhrases(
        "error",
        t.login_fail_phrases,
        locale === "es" ? "Inténtalo de nuevo." : "Please try again.",
    );
    const locked = submitting || outcome.kind === "success";

    useEffect(() => {
        let cancelled = false;

        void authService.getMe()
            .then(() => {
                if (!cancelled) {
                    window.location.replace(returnTo);
                }
            })
            .catch(() => {
                if (!cancelled) setCheckingExistingSession(false);
            });

        return () => {
            cancelled = true;
        };
    }, [returnTo]);

    useEffect(() => {
        if (outcome.kind !== "success") return;
        const delay = loginStatusRedirectDelayMs(successPhrases.length);
        const timer = window.setTimeout(() => {
            window.location.assign(returnTo);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [outcome.kind, returnTo, successPhrases.length]);

    if (checkingExistingSession) {
        return (
            <AuthShell contentClassName="my-auto flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent" aria-label={t.loading} />
            </AuthShell>
        );
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (locked) return;
        setOutcome({ kind: "idle" });

        const prepared = prepareLoginCredentials(email, password, getAuthFormMessages(locale));
        if (prepared.error !== null || prepared.credentials === null) {
            const message =
                prepared.error ??
                (locale === "es" ? "Revisa tus credenciales." : "Check your credentials.");
            setOutcome({ kind: "error", message });
            return;
        }

        setSubmitting(true);
        try {
            clearSessionCache();
            await authService.login(prepared.credentials.email, prepared.credentials.password);
            await authService.getMe();
            setOutcome({ kind: "success" });
        } catch (err: unknown) {
            const message = getAuthErrorMessage(
                err,
                locale === "es" ? "No se pudo iniciar la sesión." : "Could not sign in.",
            );
            setOutcome({ kind: "error", message });
        } finally {
            setSubmitting(false);
        }
    };

    const benefits = [t.hero_benefit_1, t.hero_benefit_2, t.hero_benefit_3];

    return (
        <AuthShell
            wide
            contentClassName="justify-start sm:justify-center py-2 sm:py-6 lg:py-8"
        >
            <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
                {/* Marketing — desktop primary; compact strip on mobile after form */}
                <section className="order-2 hidden min-w-0 flex-1 text-left lg:order-1 lg:block lg:max-w-xl">
                    <AuthLogo className="mb-8 w-44 xl:w-52" priority />

                    <div className="mb-5 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-[11px] font-semibold text-accent">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            {t.feature_tax}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--text-main)]/20 bg-[var(--text-main)]/8 px-3 py-1 text-[11px] font-semibold text-[var(--text-main)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-main)]" />
                            {t.feature_collab}
                        </span>
                    </div>

                    <h1 className="mb-4 text-4xl font-bold tracking-tight text-[var(--text-main)] xl:mb-5 xl:text-5xl xl:leading-[1.08]">
                        {t.title_hero} <span className="text-accent">{t.title_hero_accent}</span>
                    </h1>
                    <p className="mb-8 max-w-lg text-base leading-relaxed text-[var(--text-muted)]">
                        {t.desc_hero}
                    </p>

                    <ul className="mb-8 max-w-md space-y-3">
                        {benefits.map((benefit) => (
                            <li key={benefit} className="flex items-start gap-2.5 text-sm">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                <span className="leading-snug text-[var(--text-muted)]">{benefit}</span>
                            </li>
                        ))}
                    </ul>

                    <Link
                        href="/subscription"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline ui-motion"
                    >
                        {t.free_trial_link}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </section>

                {/* Auth column — mobile-first single stack */}
                <section className="order-1 w-full min-w-0 lg:order-2 lg:w-[min(100%,26rem)] lg:shrink-0">
                    <div className="mb-4 flex flex-col items-center gap-3 lg:mb-5 lg:items-stretch">
                        <AuthLogo className="w-[9.5rem] sm:w-40 lg:hidden" priority />
                        <p className="max-w-[18rem] text-center text-sm leading-snug text-[var(--text-muted)] lg:hidden">
                            {t.login_welcome_sub}
                        </p>
                    </div>

                    <PremiumTabs
                        layout="fit"
                        tabs={[
                            { id: "login", label: t.sign_in },
                            { id: "register", label: t.request_access },
                        ]}
                        activeTab="login"
                        onChange={(id) => {
                            if (id === "register") router.push("/register");
                        }}
                        className="mb-4"
                    />

                    <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-5 sm:p-7">
                        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit} noValidate>
                            <div className="hidden space-y-1 sm:block sm:text-left">
                                <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
                                    {t.login_welcome}
                                </h2>
                                <p className="text-sm text-[var(--text-muted)]">{t.login_welcome_sub}</p>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="h-12 w-full rounded-2xl bg-[var(--bg-tertiary)]/80"
                                disabled={locked}
                                onClick={() => toast(t.google_soon)}
                            >
                                <GoogleGlyph className="h-4 w-4" />
                                {t.google_button}
                            </Button>

                            <div className="relative flex items-center gap-3 py-0.5">
                                <div className="h-px flex-1 bg-[var(--border-soft)]" />
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                    {t.or_continue_email}
                                </span>
                                <div className="h-px flex-1 bg-[var(--border-soft)]" />
                            </div>

                            <div className="min-w-0 space-y-2">
                                <Label htmlFor="login-email" className={AUTH_LABEL_CLASS}>
                                    {t.email_label}
                                </Label>
                                <div className="relative min-w-0">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        enterKeyHint="next"
                                        className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl py-3.5 pl-11`}
                                        placeholder={t.email_placeholder}
                                        required
                                        disabled={locked}
                                        value={email}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            setEmail(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <div className="min-w-0 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="login-password" className={AUTH_LABEL_CLASS + " mb-0"}>
                                        {t.password_label}
                                    </Label>
                                    <Link
                                        href="/forgot-password"
                                        className="shrink-0 text-xs font-semibold text-accent hover:underline ui-motion"
                                    >
                                        {t.forgot_password}
                                    </Link>
                                </div>
                                <div className="relative min-w-0">
                                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <Input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        autoComplete="current-password"
                                        enterKeyHint="go"
                                        className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl py-3.5 pl-11 pr-12`}
                                        placeholder={t.password_placeholder}
                                        required
                                        disabled={locked}
                                        value={password}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            setPassword(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? t.hide_password : t.show_password}
                                        disabled={locked}
                                        className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] ui-motion disabled:opacity-50"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {outcome.kind === "success" ? (
                                <LoginStatusFeedback
                                    variant="success"
                                    title={t.success_login}
                                    phrases={successPhrases}
                                />
                            ) : outcome.kind === "error" ? (
                                <LoginStatusFeedback
                                    variant="error"
                                    title={outcome.message}
                                    phrases={failPhrases}
                                />
                            ) : null}

                            <Button
                                type="submit"
                                disabled={locked}
                                size="lg"
                                className="h-12 w-full rounded-2xl"
                            >
                                {locked ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {outcome.kind === "success"
                                            ? t.success_login_hint
                                            : t.signing_in}
                                    </>
                                ) : (
                                    t.sign_in
                                )}
                            </Button>

                            <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-[var(--text-muted)]">
                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>{t.secure_connection}</span>
                            </p>
                        </form>
                    </AuthGlassCard>

                    {/* Mobile-only compact brand footer — keeps first viewport form-focused */}
                    <div className="mt-5 space-y-3 text-center lg:hidden">
                        <h1 className="text-balance text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                            {t.title_hero}{" "}
                            <span className="text-accent">{t.title_hero_accent}</span>
                        </h1>
                        <Link
                            href="/subscription"
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-sm font-semibold text-accent hover:underline ui-motion"
                        >
                            {t.free_trial_link}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
