"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import {
    getAuthErrorMessage,
    getAuthFormMessages,
    preparePasswordResetEmail,
} from "@/lib/auth-forms";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { useThemeMode } from "@/lib/theme";
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
    const [theme, setTheme] = useThemeMode();

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
            const message = getAuthErrorMessage(
                err,
                locale === "es" ? "No se pudo procesar la solicitud." : "Error processing request",
            );
            setAlertMsg({ type: "error", text: message });
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-hidden overflow-y-auto bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] transition-colors duration-300 sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle={true} theme={theme} onThemeChange={setTheme} />

            <div className="relative z-10 my-auto flex w-full min-w-0 max-w-md flex-col justify-center">
                <div className="flex justify-center mb-6">
                    <AuthLogo className="w-32 sm:w-40" priority />
                </div>

                <div className="backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-soft)] shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] rounded-3xl p-6 sm:p-8 relative">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                    {submitted ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h2 className="text-2xl font-black">
                                {locale === "es" ? "Enlace Enviado" : "Reset Link Sent"}
                            </h2>
                            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                {locale === "es"
                                    ? `Hemos enviado instrucciones de restablecimiento al correo: ${email}. Por favor, revisa tu bandeja de entrada.`
                                    : `We have sent reset instructions to: ${email}. Please check your inbox.`}
                            </p>

                            <button
                                type="button"
                                onClick={() => router.push("/login")}
                                className="w-full bg-[var(--text-main)] text-[var(--bg-primary)] font-semibold rounded-xl py-3 hover:opacity-90 ui-motion mt-6 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]"
                            >
                                {locale === "es" ? "Volver a iniciar sesión" : "Back to Login"}
                            </button>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mb-2 group"
                                >
                                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                                    {locale === "es" ? "Volver" : "Back"}
                                </Link>
                                <h1 className="text-2xl font-black mt-2 leading-tight">
                                    {locale === "es" ? "¿Olvidaste tu contraseña?" : "Forgot Password?"}
                                </h1>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    {locale === "es"
                                        ? "Introduce tu correo registrado y te enviaremos un enlace de recuperación."
                                        : "Enter your registered email and we will send you a recovery link."}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="forgot-password-email" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                                    {t.email_label}
                                </label>
                                <div className="relative">
                                    <input
                                        id="forgot-password-email"
                                        type="email"
                                        name="recovery_email"
                                        autoComplete="email"
                                        inputMode="email"
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-11 pr-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] ui-motion"
                                        placeholder={t.email_placeholder}
                                        required
                                        value={email}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            setEmail(e.target.value)
                                        }
                                    />
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                                </div>
                            </div>

                            {alertMsg.text !== "" && (
                                <div
                                    className={`py-3 px-4 rounded-xl border text-sm text-center font-medium shadow-[0_0_15px_rgba(0,0,0,0.1)] ui-motion ${
                                        alertMsg.type === "error"
                                            ? "border-red-500/50 text-red-400 bg-red-500/10 shadow-red-500/20"
                                            : "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-emerald-500/20"
                                    }`}
                                >
                                    {alertMsg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 bg-[var(--text-main)] text-[var(--bg-primary)] font-semibold rounded-xl py-3 hover:opacity-90 ui-motion mt-4 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)] disabled:opacity-50 cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                                {submitting
                                    ? (locale === "es" ? "Enviando..." : "Sending...")
                                    : (locale === "es" ? "Enviar enlace" : "Send reset link")}
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
