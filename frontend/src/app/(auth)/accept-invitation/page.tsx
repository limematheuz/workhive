"use client";

import { ChangeEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { PasswordCreationFields } from "@/components/auth/PasswordCreationFields";
import { useDictionary } from "@/lib/dictionary-context";
import { getAuthErrorMessage } from "@/lib/auth-forms";
import { isStrongPassword } from "@/lib/password-strength";
import { useThemeMode } from "@/lib/theme";
import { authService } from "@/services/auth.service";

function AcceptInvitationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [token, setToken] = useState("");
    const { locale } = useDictionary();
    const [theme, setTheme] = useThemeMode();
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [acceptLegal, setAcceptLegal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [accepted, setAccepted] = useState(false);

    useEffect(() => {
        const tokenFromFragment = new URLSearchParams(window.location.hash.slice(1)).get("token");
        const legacyToken = searchParams.get("token");
        const invitationToken = tokenFromFragment || legacyToken || "";
        if (tokenFromFragment || legacyToken) {
            window.history.replaceState(null, "", "/accept-invitation");
        }
        const timeoutId = window.setTimeout(() => setToken(invitationToken), 0);
        return () => window.clearTimeout(timeoutId);
    }, [searchParams]);

    const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting || password !== confirmPassword || !acceptLegal) return;
        setSubmitting(true);
        try {
            await authService.acceptWorkerInvitation(
                token,
                code,
                password,
            );
            setAccepted(true);
            setTimeout(() => router.push("/login"), 1800);
        } catch (error: unknown) {
            const message = getAuthErrorMessage(
                error,
                locale === "es" ? "No se pudo activar tu acceso." : "Could not activate your access.",
            );
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const invalid = !token || !/^\d{8}$/.test(code) || !isStrongPassword(password) || password !== confirmPassword || !acceptLegal;
    const text = locale === "es" ? {
        title: "Activa tu acceso",
        intro: "Introduce el código recibido por correo y crea tu contraseña.",
        code: "Código de verificación",
        password: "Contraseña",
        confirm: "Confirmar contraseña",
        legal: "Acepto los términos y la política de privacidad.",
        submit: "Crear mi acceso",
        creating: "Creando acceso...",
        successTitle: "Acceso activado",
        success: "Tu cuenta está lista. Redirigiendo al inicio de sesión...",
        invalid: "El enlace de invitación no es válido. Pide a tu administrador que te envíe uno nuevo.",
    } : {
        title: "Activate your access",
        intro: "Enter the code from your email and create your password.",
        code: "Verification code",
        password: "Password",
        confirm: "Confirm password",
        legal: "I accept the terms and privacy notice.",
        submit: "Create my access",
        creating: "Creating access...",
        successTitle: "Access activated",
        success: "Your account is ready. Redirecting to sign in...",
        invalid: "This invitation link is invalid. Ask your administrator to send a new one.",
    };

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle theme={theme} onThemeChange={setTheme} />
            <section className="my-auto w-full max-w-md rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-xl sm:p-8">
                <div className="mb-6 flex justify-center"><AuthLogo className="w-32 sm:w-40" priority /></div>
                {accepted ? (
                    <div className="space-y-3 py-6 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
                        <h1 className="text-2xl font-black">{text.successTitle}</h1>
                        <p className="text-sm text-[var(--text-muted)]">{text.success}</p>
                    </div>
                ) : !token ? (
                    <div className="space-y-3 py-6 text-center">
                        <MailCheck className="mx-auto h-12 w-12 text-red-500" />
                        <p className="text-sm text-[var(--text-muted)]">{text.invalid}</p>
                    </div>
                ) : (
                    <form className="space-y-5" onSubmit={onSubmit} autoComplete="off">
                        <div>
                            <h1 className="text-2xl font-black">{text.title}</h1>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{text.intro}</p>
                        </div>
                        <label className="block text-sm font-medium text-[var(--text-muted)]">
                            {text.code}
                            <input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={8}
                                required
                                value={code}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setCode(event.target.value.replace(/\D/g, ""))}
                                className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-[var(--text-main)] outline-none focus:border-accent/50"
                            />
                        </label>
                        <PasswordCreationFields
                            locale={locale}
                            password={password}
                            confirmPassword={confirmPassword}
                            acceptLegal={acceptLegal}
                            onPasswordChange={setPassword}
                            onConfirmPasswordChange={setConfirmPassword}
                            onAcceptLegalChange={setAcceptLegal}
                            idPrefix="worker-invitation"
                        />
                        <button type="submit" disabled={submitting || invalid} className="w-full rounded-xl bg-[var(--text-main)] py-3 font-semibold text-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-50">
                            {submitting ? text.creating : text.submit}
                        </button>
                    </form>
                )}
            </section>
        </main>
    );
}

export default function AcceptInvitationPage() {
    return <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}><AcceptInvitationContent /></Suspense>;
}
