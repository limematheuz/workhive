"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { useRouter } from "next/navigation";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { BrandIconWell } from "@/components/ui/brand-icon-well";
import { ArrowLeft, User, Building2 } from "lucide-react";

function RegisterPageContent() {
    const router = useRouter();
    const { dict, locale } = useDictionary();
    const t = dict.auth;

    return (
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-hidden overflow-y-auto bg-[var(--bg-primary)] px-4 pb-6 pt-24 text-[var(--text-main)] transition-colors duration-300 sm:pt-20 md:p-8">
            <AuthTopControls showThemeToggle={false} />

            <section className="relative my-auto w-full min-w-0 max-w-xl overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-xl sm:p-6 md:p-8">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-soft)] to-transparent" />
                
                <div className="mb-6 flex items-center justify-between">
                    <AuthLogo className="w-32 sm:w-40" priority />
                </div>

                <PremiumTabs
                    tabs={[
                        { id: "login", label: t.sign_in },
                        { id: "register", label: "Solicitar acceso" }
                    ]}
                    activeTab="register"
                    onChange={(id) => {
                        if (id === "login") router.push("/login");
                    }}
                    className="mb-6"
                />

                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight mb-2 text-[var(--text-main)]">
                    {locale === "es" ? "Solicitar acceso a WorkHive" : "Request access to WorkHive"}
                </h1>
                <p className="text-xs text-[var(--text-muted)] mb-6">
                    {locale === "es" 
                        ? "Elige la opción que corresponda según tu perfil para empezar a operar:" 
                        : "Choose the option that matches your profile to start operating:"}
                </p>
                
                <div className="space-y-4 border-t border-[var(--border-soft)] pt-6">
                    <div className="flex min-w-0 gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4 sm:gap-4">
                        <BrandIconWell icon={User} size="md" />
                        <div className="min-w-0 space-y-1">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-main)]">
                                {locale === "es" ? "Soy trabajador u operario" : "I am an employee or technician"}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                {locale === "es" 
                                    ? "Solicita el alta directamente al administrador de tu empresa. Solo ellos pueden invitarte a su colmena desde su panel de control." 
                                    : "Ask your company administrator to invite you to their hive directly from their control panel."}
                            </p>
                        </div>
                    </div>

                    <div className="flex min-w-0 gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4 sm:gap-4">
                        <BrandIconWell icon={Building2} size="md" />
                        <div className="min-w-0 space-y-1">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-main)]">
                                {locale === "es" ? "Quiero registrar mi empresa" : "I want to register my company"}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                {locale === "es" 
                                    ? "Contacta con soporte para validar tu caso, crear la organización e iniciar una evaluación asistida de 14 días."
                                    : "Contact support to validate your use case, create the organization and start a 14-day assisted evaluation."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col justify-between gap-4 border-t border-[var(--border-soft)] pt-6 sm:flex-row">
                    <Link
                        href="/login"
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] px-5 text-xs font-bold text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)] transition-all uppercase tracking-wider justify-center"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {locale === "es" ? "Iniciar Sesión" : "Login"}
                    </Link>
                    
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                        <Link
                            href="/subscription"
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent dark:bg-accent hover:bg-accent-light dark:hover:bg-accent text-white font-bold px-5 text-xs tracking-wider uppercase transition-all"
                        >
                            {locale === "es" ? "Ver Planes" : "See Plans"}
                        </Link>
                        <Link
                            href="/contact?reason=trial"
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] hover:bg-[var(--bg-secondary)] font-bold px-5 text-xs tracking-wider uppercase transition-all"
                        >
                            {locale === "es" ? "Contacto" : "Contact"}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer with legal & contact links */}
            <footer className="z-10 mt-6 flex w-full max-w-xl flex-col items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-4 text-center text-xs text-[var(--text-muted)] sm:flex-row sm:text-left">
                <div className="min-w-0">
                    &copy; {new Date().getFullYear()} WorkHive Enterprise. {t.rights_reserved || "Todos los derechos reservados."}
                </div>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end">
                    <Link href="/contact?reason=trial" className="hover:text-[var(--text-main)] transition-colors">
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

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">Cargando...</div>}>
            <RegisterPageContent />
        </Suspense>
    );
}
