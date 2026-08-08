"use client";

import { useEffect, useState, ChangeEvent, Suspense } from "react";
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
                                <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold text-red-400">
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
                                        <label htmlFor="new-password" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                                            {locale === "es" ? "Nueva contraseña" : "New Password"}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="new-password"
                                                type={showPassword ? "text" : "password"}
                                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-11 pr-12 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] ui-motion"
                                                placeholder={t.password_placeholder}
                                                autoComplete="new-password"
                                                required
                                                value={password}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                    setPassword(e.target.value)
                                                }
                                            />
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-1 flex items-center justify-center"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <PasswordStrengthChecklist password={password} locale={locale} />

                                    <div>
                                        <label htmlFor="confirm-new-password" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                                            {locale === "es" ? "Confirmar nueva contraseña" : "Confirm New Password"}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="confirm-new-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-11 pr-12 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] ui-motion"
                                                placeholder={t.password_placeholder}
                                                autoComplete="new-password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                    setConfirmPassword(e.target.value)
                                                }
                                            />
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-1 flex items-center justify-center"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {alertMsg.text !== "" && (
                                <div
                                    className={`py-3 px-4 rounded-xl border text-sm text-center font-medium shadow-[0_0_15px_rgba(0,0,0,0.1)] ui-motion ${
                                        alertMsg.type === "error"
                                            ? "border-red-500/50 text-red-400 bg-red-500/10 shadow-red-500/20"
                                            : "border-accent/50 text-accent bg-accent/10 shadow-accent/20"
                                    }`}
                                >
                                    {alertMsg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || !token || !isStrongPassword(password)}
                                className="w-full bg-[var(--text-main)] text-[var(--bg-primary)] font-semibold rounded-xl py-3 hover:opacity-90 ui-motion mt-4 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)] disabled:opacity-50 cursor-pointer"
                            >
                                {submitting
                                    ? (locale === "es" ? "Guardando..." : "Saving...")
                                    : (locale === "es" ? "Restablecer contraseña" : "Reset Password")}
                            </button>
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
