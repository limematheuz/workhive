import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import {
    ArrowRight,
    Eye,
    EyeOff,
    Loader2,
    LockKeyhole,
    Mail,
    ShieldCheck,
} from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { LoginAccessFeedback } from "@/components/auth/LoginAccessFeedback";
import type { LoginAccessBlock, LoginFailureReason } from "@/lib/login-access";
import { LoginStatusFeedback } from "@/components/auth/LoginStatusFeedback";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumTabs } from "@/components/ui/premium-tabs";

export type LoginOutcome =
    | { kind: "idle" }
    | { kind: "access_blocked"; reason: LoginAccessBlock }
    | { kind: "error"; message: string; reason?: LoginFailureReason }
    | { kind: "success" };

type LoginFormPanelProps = {
    copy: Dictionary["auth"];
    email: string;
    password: string;
    showPassword: boolean;
    locked: boolean;
    outcome: LoginOutcome;
    successPhrases: string[];
    failPhrases: string[];
    onRequestAccess: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onPasswordChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onTogglePassword: () => void;
};

function GoogleGlyph({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

export function LoginFormPanel({
    copy,
    email,
    password,
    showPassword,
    locked,
    outcome,
    successPhrases,
    failPhrases,
    onRequestAccess,
    onSubmit,
    onEmailChange,
    onPasswordChange,
    onTogglePassword,
}: LoginFormPanelProps) {
    return (
        <section className="order-1 w-full min-w-0 lg:order-2 lg:w-[min(100%,26rem)] lg:shrink-0">
            <div className="mb-4 flex flex-col items-center gap-3 lg:mb-5 lg:items-stretch">
                <AuthLogo className="w-[9.5rem] sm:w-40 lg:hidden" priority />
                <p className="max-w-[18rem] text-center text-sm leading-snug text-[var(--text-muted)] lg:hidden">
                    {copy.login_welcome_sub}
                </p>
            </div>

            <PremiumTabs
                layout="fit"
                tabs={[
                    { id: "login", label: copy.sign_in },
                    { id: "register", label: copy.request_access },
                ]}
                activeTab="login"
                onChange={(id) => {
                    if (id === "register") onRequestAccess();
                }}
                className="mb-4"
            />

            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-5 sm:p-7">
                <form className="space-y-4 sm:space-y-5" onSubmit={onSubmit} noValidate>
                    <div className="hidden space-y-1 sm:block sm:text-left">
                        <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">{copy.login_welcome}</h2>
                        <p className="text-sm text-[var(--text-muted)]">{copy.login_welcome_sub}</p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-12 w-full rounded-2xl bg-[var(--bg-tertiary)]/80"
                        disabled={locked}
                        onClick={() => toast(copy.google_soon)}
                    >
                        <GoogleGlyph className="h-4 w-4" />
                        {copy.google_button}
                    </Button>

                    <div className="relative flex items-center gap-3 py-0.5">
                        <div className="h-px flex-1 bg-[var(--border-soft)]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{copy.or_continue_email}</span>
                        <div className="h-px flex-1 bg-[var(--border-soft)]" />
                    </div>

                    <div className="min-w-0 space-y-2">
                        <Label htmlFor="login-email" className={AUTH_LABEL_CLASS}>{copy.email_label}</Label>
                        <div className="relative min-w-0">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                            <Input id="login-email" type="email" name="email" autoComplete="email" inputMode="email" enterKeyHint="next" className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl py-3.5 pl-11`} placeholder={copy.email_placeholder} required disabled={locked} value={email} onChange={onEmailChange} />
                        </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="login-password" className={`${AUTH_LABEL_CLASS} mb-0`}>{copy.password_label}</Label>
                            <Link href="/forgot-password" className="shrink-0 text-xs font-semibold text-accent hover:underline ui-motion">{copy.forgot_password}</Link>
                        </div>
                        <div className="relative min-w-0">
                            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                            <Input id="login-password" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" enterKeyHint="go" className={`${AUTH_FIELD_CLASS} h-12 rounded-2xl py-3.5 pl-11 pr-12`} placeholder={copy.password_placeholder} required disabled={locked} value={password} onChange={onPasswordChange} />
                            <button type="button" onClick={onTogglePassword} aria-label={showPassword ? copy.hide_password : copy.show_password} disabled={locked} className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] ui-motion disabled:opacity-50">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {outcome.kind === "access_blocked" ? (
                        <LoginAccessFeedback reason={outcome.reason} copy={copy.access_blocked} />
                    ) : outcome.kind === "success" ? (
                        <LoginStatusFeedback variant="success" title={copy.success_login} phrases={successPhrases} />
                    ) : outcome.kind === "error" ? (
                        <LoginStatusFeedback variant="error" title={outcome.message} phrases={failPhrases} />
                    ) : null}

                    <Button type="submit" disabled={locked} size="lg" className="h-12 w-full rounded-2xl">
                        {locked ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />{outcome.kind === "success" ? copy.success_login_hint : copy.signing_in}</>
                        ) : copy.sign_in}
                    </Button>

                    <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-[var(--text-muted)]">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>{copy.secure_connection}</span>
                    </p>
                </form>
            </AuthGlassCard>

            <div className="mt-5 space-y-3 text-center lg:hidden">
                <h1 className="text-balance text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                    {copy.title_hero} <span className="text-accent">{copy.title_hero_accent}</span>
                </h1>
                <Link href="/subscription" className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-sm font-semibold text-accent hover:underline ui-motion">
                    {copy.free_trial_link}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </section>
    );
}
