"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { clearSessionCache } from "@/lib/auth";
import {
    getAuthErrorMessage,
    getAuthFormMessages,
    prepareLoginCredentials,
} from "@/lib/auth-forms";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import {
    LoginErrorIllustration,
    LoginSuccessIllustration,
} from "@/components/auth/AuthStatusIllustrations";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-ui";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Button } from "@/components/ui/button";
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

export default function LoginPage() {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const t = dict.auth;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting || success) return;
        setAlertMsg({ type: "", text: "" });

        const prepared = prepareLoginCredentials(email, password, getAuthFormMessages(locale));
        if (prepared.error !== null || prepared.credentials === null) {
            const message = prepared.error ?? (locale === "es" ? "Revisa tus credenciales." : "Check your credentials.");
            setAlertMsg({ type: "error", text: message });
            return;
        }

        setSubmitting(true);
        try {
            clearSessionCache();
            await authService.login(prepared.credentials.email, prepared.credentials.password);
            await authService.getMe();
            setSuccess(true);
            window.setTimeout(() => {
                window.location.assign("/dashboard");
            }, 650);
        } catch (err: unknown) {
            const message = getAuthErrorMessage(
                err,
                locale === "es" ? "No se pudo iniciar la sesión." : "Could not sign in.",
            );
            setAlertMsg({ type: "error", text: message });
        } finally {
            setSubmitting(false);
        }
    };

    const benefits = [t.hero_benefit_1, t.hero_benefit_2, t.hero_benefit_3];

    return (
        <AuthShell wide contentClassName="justify-center py-4 lg:py-8">
            <div className="flex w-full flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
                <section className="order-2 w-full flex-1 text-center lg:order-1 lg:max-w-xl lg:text-left">
                    <AuthLogo className="mx-auto mb-6 hidden w-44 lg:mx-0 lg:block xl:mb-8 xl:w-52" priority />

                    <div className="mb-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-[11px] font-semibold text-accent">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            {t.feature_tax}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--text-main)]/20 bg-[var(--text-main)]/8 px-3 py-1 text-[11px] font-semibold text-[var(--text-main)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-main)]" />
                            {t.feature_collab}
                        </span>
                    </div>

                    <h1 className="mb-4 text-3xl font-bold tracking-tight text-[var(--text-main)] sm:text-4xl xl:mb-5 xl:text-5xl xl:leading-[1.08]">
                        {t.title_hero}{" "}
                        <span className="text-accent">{t.title_hero_accent}</span>
                    </h1>
                    <p className="mx-auto mb-6 max-w-lg text-sm leading-relaxed text-[var(--text-muted)] lg:mx-0 xl:mb-8 xl:text-base">
                        {t.desc_hero}
                    </p>

                    <ul className="mx-auto mb-8 max-w-md space-y-3 text-left lg:mx-0">
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

                <section className="order-1 w-full max-w-lg lg:order-2 lg:w-[min(100%,34rem)] lg:shrink-0">
                    <div className="mb-5 flex justify-center lg:hidden">
                        <AuthLogo className="w-40" priority />
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
                        className="mb-5"
                    />

                    <AuthGlassCard className="border-[var(--border-soft)] p-7 sm:p-9">
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-1.5 text-center sm:text-left">
                                <h2 className="text-xl font-bold tracking-tight">{t.login_welcome}</h2>
                                <p className="text-sm text-[var(--text-muted)]">{t.login_welcome_sub}</p>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="h-12 w-full rounded-2xl bg-[var(--bg-card)]"
                                disabled={success || submitting}
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

                            <div>
                                <label htmlFor="login-email" className={AUTH_LABEL_CLASS}>
                                    {t.email_label}
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        className={`${AUTH_FIELD_CLASS} rounded-2xl py-3.5 pl-11`}
                                        placeholder={t.email_placeholder}
                                        required
                                        disabled={success || submitting}
                                        value={email}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                        {t.password_label}
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs font-semibold text-accent hover:underline ui-motion"
                                    >
                                        {t.forgot_password}
                                    </Link>
                                </div>
                                <div className="relative">
                                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        autoComplete="current-password"
                                        className={`${AUTH_FIELD_CLASS} rounded-2xl py-3.5 pl-11 pr-12`}
                                        placeholder={t.password_placeholder}
                                        required
                                        disabled={success || submitting}
                                        value={password}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? t.hide_password : t.show_password}
                                        disabled={success || submitting}
                                        className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] ui-motion disabled:opacity-50"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {success ? (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/70"
                                >
                                    <div className="flex justify-center px-4 pt-4">
                                        <LoginSuccessIllustration className="h-20 w-36 text-[var(--text-main)]" />
                                    </div>
                                    <div className="space-y-1 px-4 pb-3 text-center">
                                        <p className="text-sm font-semibold text-[var(--text-main)]">
                                            {t.success_login}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {t.success_login_hint}
                                        </p>
                                    </div>
                                    <div className="mx-auto mb-4 h-[2px] w-28 overflow-hidden rounded-full bg-[var(--border-soft)]" aria-hidden>
                                        <div className="h-full w-full origin-left scale-x-0 rounded-full bg-[var(--text-main)]/50 animate-[login-progress_0.7s_ease-out_forwards]" />
                                    </div>
                                </div>
                            ) : alertMsg.text !== "" ? (
                                <div
                                    role="alert"
                                    className="overflow-hidden rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)]"
                                >
                                    <div className="flex justify-center px-4 pt-4">
                                        <LoginErrorIllustration className="h-20 w-36 text-[var(--text-main)]" />
                                    </div>
                                    <p className="px-4 pb-4 text-center text-sm font-medium leading-snug text-[var(--btn-cancel-text)]">
                                        {alertMsg.text}
                                    </p>
                                </div>
                            ) : null}

                            <Button
                                type="submit"
                                disabled={submitting || success}
                                size="lg"
                                className="mt-1 h-12 w-full rounded-2xl"
                            >
                                {submitting || success ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {success ? t.success_login_hint : t.signing_in}
                                    </>
                                ) : (
                                    t.sign_in
                                )}
                            </Button>

                            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[var(--text-muted)]">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {locale === "es"
                                    ? "Conexión cifrada · acceso por roles"
                                    : "Encrypted connection · role-based access"}
                            </p>
                        </form>
                    </AuthGlassCard>
                </section>
            </div>
        </AuthShell>
    );
}
