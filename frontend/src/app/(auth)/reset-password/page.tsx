"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import {
    getAuthErrorMessage,
    getAuthFormMessages,
    preparePasswordResetRequest,
} from "@/lib/auth-forms";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { useThemeMode } from "@/lib/theme";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { isStrongPassword } from "@/lib/password-strength";
import { PasswordStrengthChecklist } from "@/components/auth/PasswordStrengthChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [token] = useState(() => searchParams.get("token") || "");

    const { dict, locale } = useDictionary();
    const t = dict.auth;

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });
    const [theme, setTheme] = useThemeMode();

    const showError = (text: string) => {
        setAlertMsg({ type: "error", text });
        toast.error(text);
    };

    useEffect(() => {
        if (!token) return;
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`
        );
    }, [token]);

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        setAlertMsg({ type: "", text: "" });

        const prepared = preparePasswordResetRequest(
            token,
            password,
            confirmPassword,
            getAuthFormMessages(locale),
        );
        if (prepared.error !== null) {
            showError(prepared.error);
            return;
        }

        setSubmitting(true);
        try {
            await authService.resetPassword(prepared.token, prepared.password);
            setSubmitted(true);
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err: unknown) {
            const message = getAuthErrorMessage(
                err,
                locale === "es" ? "No se pudo restablecer la contraseña." : "Error resetting password",
            );
            showError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-hidden bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] transition-colors duration-300 sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle={true} theme={theme} onThemeChange={setTheme} />

            <div className="relative z-10 my-auto flex w-full min-w-0 max-w-md flex-col justify-center">
                <div className="flex justify-center mb-6">
                    <AuthLogo className="w-32 sm:w-40" priority />
                </div>

                <div className="backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-soft)] shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] rounded-3xl p-6 sm:p-8 relative">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                    {submitted ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="inline-flex p-4 rounded-full bg-accent/10 text-accent mb-2">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h2 className="text-2xl font-black">
                                {locale === "es" ? "Contraseña Cambiada" : "Password Changed"}
                            </h2>
                            <p className="text-[var(--text-muted)] text-sm">
                                {locale === "es"
                                    ? "Tu contraseña ha sido restablecida con éxito. Redirigiendo al inicio de sesión..."
                                    : "Your password has been successfully reset. Redirecting to login..."}
                            </p>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
                            <div>
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mb-2 group"
                                >
                                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                                    {locale === "es" ? "Volver" : "Back"}
                                </Link>
                                <h1 className="text-2xl font-black mt-2 leading-tight">
                                    {locale === "es" ? "Nueva contraseña" : "New Password"}
                                </h1>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    {locale === "es"
                                        ? "Elige una contraseña nueva y segura de al menos 8 caracteres."
                                        : "Choose a new secure password of at least 8 characters."}
                                </p>
                            </div>

                            {!token && (
                                <div className="flex gap-3 rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4">
                                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--btn-cancel-text)]" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold text-[var(--btn-cancel-text)]">
                                            {locale === "es" ? "Enlace de recuperación inválido" : "Invalid recovery link"}
                                        </p>
                                        <p className="text-[var(--text-muted)] leading-relaxed">
                                            {locale === "es"
                                                ? "Falta el token de verificación. Comprueba el enlace que recibiste en el correo o solicita uno nuevo."
                                                : "Verification token is missing. Please check the email link or request a new one."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {token && (
                                <>
                                    <div>
                                        <Label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[var(--text-muted)]">
                                            {locale === "es" ? "Nueva contraseña" : "New Password"}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="new-password"
                                                type={showPassword ? "text" : "password"}
                                                className="h-12 pl-11 pr-12"
                                                placeholder={t.password_placeholder}
                                                autoComplete="new-password"
                                                required
                                                value={password}
                                                onChange={(e) =>
                                                    setPassword(e.target.value)
                                                }
                                            />
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    <PasswordStrengthChecklist password={password} locale={locale} />

                                    <div>
                                        <Label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium text-[var(--text-muted)]">
                                            {locale === "es" ? "Confirmar nueva contraseña" : "Confirm New Password"}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirm-new-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                className="h-12 pl-11 pr-12"
                                                placeholder={t.password_placeholder}
                                                autoComplete="new-password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e) =>
                                                    setConfirmPassword(e.target.value)
                                                }
                                            />
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {alertMsg.text !== "" && (
                                <div
                                    className={`rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-[0_0_15px_rgba(0,0,0,0.1)] ui-motion ${
                                        alertMsg.type === "error"
                                            ? "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]"
                                            : "border-accent/50 text-accent bg-accent/10 shadow-accent/20"
                                    }`}
                                >
                                    {alertMsg.text}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={submitting || !token || !isStrongPassword(password)}
                                className="mt-4 w-full"
                            >
                                {submitting
                                    ? (locale === "es" ? "Guardando..." : "Saving...")
                                    : (locale === "es" ? "Restablecer contraseña" : "Reset Password")}
                            </Button>
                        </form>
                    )}
                </div>
            </div>

            <footer className="z-10 mt-6 flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-4 text-center text-xs text-[var(--text-muted)] sm:flex-row sm:text-left">
                <div className="min-w-0">
                    &copy; {new Date().getFullYear()} WorkHive Enterprise. {t.rights_reserved || "Todos los derechos reservados."}
                </div>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end">
                    <Link href="/contact" className="hover:text-[var(--text-main)] transition-colors">
                        {t.contact_link || "Contacto y Soporte"}
                    </Link>
                    <Link href="/terms" className="hover:text-[var(--text-main)] transition-colors">
                        {t.terms_link || "Términos y condiciones"}
                    </Link>
                    <Link href="/privacy" className="hover:text-[var(--text-main)] transition-colors">
                        {t.privacy_link || "Política de privacidad"}
                    </Link>
                </div>
            </footer>
        </main>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">Cargando...</div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}
