"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import {
    getAuthFormMessages,
    preparePasswordResetEmail,
} from "@/lib/auth-forms";
import { getPasswordRecoveryErrorMessage } from "@/lib/password-recovery-error";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS, authAlertClass } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const t = dict.auth;

    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setAlertMsg({ type: "", text: "" });

        const prepared = preparePasswordResetEmail(email, getAuthFormMessages(locale));
        if (prepared.error !== null) {
            setAlertMsg({ type: "error", text: prepared.error });
            toast.error(prepared.error);
            return;
        }

        setSubmitting(true);
        try {
            await authService.requestPasswordReset(prepared.email);
            setEmail(prepared.email);
            setSubmitted(true);
        } catch (err: unknown) {
            const message = getPasswordRecoveryErrorMessage(err, locale);
            setAlertMsg({ type: "error", text: message });
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell contentClassName="my-auto w-full max-w-md">
            <div className="mb-6 flex justify-center">
                <AuthLogo className="w-32 sm:w-40" priority />
            </div>

            <AuthGlassCard>
                {submitted ? (
                    <div className="space-y-4 py-4 text-center">
                        <div className="mb-2 inline-flex rounded-full bg-accent/10 p-4 text-accent">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">{t.forgot_sent_title}</h2>
                        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                            {t.forgot_sent_body.replace("{email}", email)}
                        </p>
                        <Button
                            type="button"
                            size="lg"
                            className="mt-4 w-full"
                            onClick={() => router.push("/login")}
                        >
                            {t.forgot_back_login}
                        </Button>
                    </div>
                ) : (
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <Link
                                href="/login"
                                className="group mb-3 inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] ui-motion"
                            >
                                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                                {t.back}
                            </Link>
                            <h1 className="text-2xl font-bold tracking-tight">{t.forgot_title}</h1>
                            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                                {t.forgot_subtitle}
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="forgot-password-email" className={AUTH_LABEL_CLASS}>
                                {t.email_label}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="forgot-password-email"
                                    type="email"
                                    name="recovery_email"
                                    autoComplete="email"
                                    inputMode="email"
                                    className={`${AUTH_FIELD_CLASS} pl-11`}
                                    placeholder={t.email_placeholder}
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                            </div>
                        </div>

                        {alertMsg.text !== "" && (
                            <div className={authAlertClass("error")}>{alertMsg.text}</div>
                        )}

                        <Button type="submit" disabled={submitting} size="lg" className="w-full">
                            <Send className="h-4 w-4" />
                            {submitting ? t.forgot_sending : t.forgot_send}
                        </Button>
                    </form>
                )}
            </AuthGlassCard>
        </AuthShell>
    );
}
