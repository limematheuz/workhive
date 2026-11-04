"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginFormPanel, type LoginOutcome } from "@/components/auth/LoginFormPanel";
import { LoginMarketingPanel } from "@/components/auth/LoginMarketingPanel";
import { getLoginAccessBlock } from "@/lib/login-access";
import { clearSessionCache } from "@/lib/auth";
import {
    getAuthErrorMessage,
    getAuthFormMessages,
    prepareLoginCredentials,
} from "@/lib/auth-forms";
import { useDictionary } from "@/lib/dictionary-context";
import {
    loginStatusRedirectDelayMs,
    resolveLoginStatusPhrases,
} from "@/lib/login-status";
import { authService } from "@/services/auth.service";

export default function LoginPageClient({ returnTo }: { returnTo: string }) {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const copy = dict.auth;
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<LoginOutcome>({ kind: "idle" });
    const [checkingExistingSession, setCheckingExistingSession] = useState(true);

    const successPhrases = resolveLoginStatusPhrases(
        "success",
        copy.login_success_phrases,
        copy.success_login_hint,
    );
    const failPhrases = resolveLoginStatusPhrases(
        "error",
        copy.login_fail_phrases,
        locale === "es" ? "Inténtalo de nuevo." : "Please try again.",
    );
    const locked = submitting || outcome.kind === "success";

    useEffect(() => {
        let cancelled = false;
        void authService.getMe()
            .then(() => {
                if (!cancelled) window.location.replace(returnTo);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    const reason = getLoginAccessBlock(error);
                    if (reason) setOutcome({ kind: "access_blocked", reason });
                    setCheckingExistingSession(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [returnTo]);

    useEffect(() => {
        if (outcome.kind !== "success") return;
        const timer = window.setTimeout(
            () => window.location.assign(returnTo),
            loginStatusRedirectDelayMs(successPhrases.length),
        );
        return () => window.clearTimeout(timer);
    }, [outcome.kind, returnTo, successPhrases.length]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (locked) return;
        setOutcome({ kind: "idle" });

        const prepared = prepareLoginCredentials(email, password, getAuthFormMessages(locale));
        if (prepared.error !== null || prepared.credentials === null) {
            setOutcome({
                kind: "error",
                message: prepared.error ?? (locale === "es" ? "Revisa tus credenciales." : "Check your credentials."),
            });
            return;
        }

        setSubmitting(true);
        try {
            clearSessionCache();
            await authService.login(prepared.credentials.email, prepared.credentials.password);
            await authService.getMe();
            setOutcome({ kind: "success" });
        } catch (error: unknown) {
            const reason = getLoginAccessBlock(error);
            if (reason) {
                setOutcome({ kind: "access_blocked", reason });
                return;
            }
            setOutcome({
                kind: "error",
                message: getAuthErrorMessage(
                    error,
                    locale === "es" ? "No se pudo iniciar la sesión." : "Could not sign in.",
                ),
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (checkingExistingSession) {
        return (
            <AuthShell contentClassName="my-auto flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent" aria-label={copy.loading} />
            </AuthShell>
        );
    }

    return (
        <AuthShell wide contentClassName="justify-start py-2 sm:justify-center sm:py-6 lg:py-8">
            <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
                <LoginMarketingPanel copy={copy} />
                <LoginFormPanel
                    copy={copy}
                    email={email}
                    password={password}
                    showPassword={showPassword}
                    locked={locked}
                    outcome={outcome}
                    successPhrases={successPhrases}
                    failPhrases={failPhrases}
                    onRequestAccess={() => router.push("/register")}
                    onSubmit={handleSubmit}
                    onEmailChange={(event) => setEmail(event.target.value)}
                    onPasswordChange={(event) => setPassword(event.target.value)}
                    onTogglePassword={() => setShowPassword((value) => !value)}
                />
            </div>
        </AuthShell>
    );
}
