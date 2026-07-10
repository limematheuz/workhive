"use client";

// Authentication login page
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
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/toast";

export default function LoginPage() {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const t = dict.auth;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [alertMsg, setAlertMsg] = useState({ type: "", text: "" });

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        setAlertMsg({ type: "", text: "" });

        const prepared = prepareLoginCredentials(email, password, getAuthFormMessages(locale));
        if (prepared.error !== null || prepared.credentials === null) {
            const message = prepared.error ?? (locale === "es" ? "Revisa tus credenciales." : "Check your credentials.");
            setAlertMsg({ type: "error", text: message });
            toast.error(message);
            return;
        }

        setSubmitting(true);
        try {
            clearSessionCache();
            await authService.login(prepared.credentials.email, prepared.credentials.password);
            await authService.getMe();
            setAlertMsg({ type: "success", text: t.success_login });
            window.location.assign("/dashboard");
        } catch (err: unknown) {
            const message = getAuthErrorMessage(
                err,
                locale === "es" ? "No se pudo iniciar la sesión." : "Could not sign in.",
            );
            setAlertMsg({ type: "error", text: message });
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="h-screen w-screen max-w-full overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-between p-4 py-6 md:p-8 relative bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-300">
            <AuthTopControls showThemeToggle={false} />

            <div className="w-full max-w-6xl relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-16 xl:gap-24 py-4 lg:py-0 lg:my-auto">
                <div className="flex justify-center w-full lg:hidden mb-4">
                    <AuthLogo className="w-40" priority />
                </div>

                <div className="w-full max-w-md lg:w-[450px] order-1 lg:order-2">
                    <PremiumTabs
                        tabs={[
                            { id: "login", label: t.sign_in },
                            { id: "register", label: "Solicitar acceso" }
                        ]}
                        activeTab="login"
                        onChange={(id) => {
                            if (id === "register") router.push("/register");
                        }}
                        className="mb-8"
                    />

                    <div className="backdrop-blur-xl bg-[var(--bg-card)] border border-[var(--border-soft)] shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] rounded-3xl p-6 sm:p-8 relative">
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="login-email" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                                    {t.email_label}
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    inputMode="email"
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl px-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] transition-all"
                                    placeholder={t.email_placeholder}
                                    required
                                    value={email}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        setEmail(e.target.value)
                                    }
                                />
                            </div>

                            <div>
                                <label htmlFor="login-password" className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                                    {t.password_label}
                                </label>
                                <div className="relative">
                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        autoComplete="current-password"
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-4 pr-12 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent/50 focus:bg-[var(--bg-secondary)] transition-all"
                                        placeholder={t.password_placeholder}
                                        required
                                        value={password}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            setPassword(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword
                                            ? (locale === "es" ? "Ocultar contraseña" : "Hide password")
                                            : (locale === "es" ? "Mostrar contraseña" : "Show password")}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-1 flex items-center justify-center"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-end mt-4">
                                <Link
                                    href="/forgot-password"
                                    className="text-sm text-[var(--text-muted)] hover:text-accent transition-colors"
                                >
                                    {t.forgot_password}
                                </Link>
                            </div>

                            {alertMsg.text !== "" && (
                                <div
                                    className={`py-3 px-4 rounded-xl border text-sm text-center font-medium shadow-[0_0_15px_rgba(0,0,0,0.1)] transition-all ${
                                        alertMsg.type === "error"
                                            ? "border-red-500/50 text-red-400 bg-red-500/10 shadow-red-500/20"
                                            : alertMsg.type === "success"
                                              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-emerald-500/20"
                                              : "border-orange-500/50 text-orange-400 bg-orange-500/10 shadow-orange-500/20"
                                    }`}
                                >
                                    {alertMsg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-[var(--text-main)] text-[var(--bg-primary)] font-semibold rounded-xl py-3 hover:opacity-90 transition-all mt-6 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]"
                            >
                                {submitting
                                    ? (locale === "es" ? "Entrando..." : "Signing in...")
                                    : t.sign_in}
                            </button>

                        </form>
                    </div>
                </div>

                <div className="flex flex-col flex-1 text-[var(--text-main)] order-2 lg:order-1 text-center lg:text-left mt-8 lg:mt-0 pb-12 lg:pb-0">
                    <AuthLogo className="hidden w-44 self-start lg:block xl:w-52 mb-4 xl:mb-8" priority />
                    
                    {/* Curated SaaS-style Feature Pills above title */}
                    <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 text-xs font-semibold mb-4 xl:mb-6">
                        <div className="flex items-center gap-1.5 bg-accent/10 text-accent dark:text-accent rounded-full px-3.5 py-1.5 border border-accent/20 hover:scale-105 transition-transform duration-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {t.feature_tax}
                        </div>
                        <div className="flex items-center gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full px-3.5 py-1.5 border border-purple-500/20 hover:scale-105 transition-transform duration-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            {t.feature_collab}
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-bold mb-4 xl:mb-6 tracking-tight leading-tight text-[var(--text-main)]">
                        {t.title_hero}{" "}
                        <br className="hidden lg:block" />
                        <span className="text-accent">{t.title_hero_accent}</span>
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm xl:text-base mb-6 xl:mb-8 max-w-lg leading-relaxed mx-auto lg:mx-0">
                        {t.desc_hero}
                    </p>

                    {/* Controlled evaluation prompt */}
                    <div className="mt-2 text-center lg:text-left">
                        <Link
                            href="/subscription"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-accent dark:text-accent hover:text-accent dark:hover:text-accent hover:underline transition-all"
                        >
                            <span>{t.free_trial_link || "Solicitar evaluación de 14 días"}</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer with legal & contact links */}
            <footer className="w-full max-w-6xl mt-auto pt-4 xl:pt-6 border-t border-[var(--border-soft)] z-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[var(--text-muted)]">
                <div>
                    &copy; {new Date().getFullYear()} WorkHive Enterprise. {t.rights_reserved || "Todos los derechos reservados."}
                </div>
                <div className="flex gap-6">
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
