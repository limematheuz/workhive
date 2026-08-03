"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthTopControls } from "@/components/auth/AuthTopControls";
import { ArrowLeft, Check, Shield, Flame } from "lucide-react";

export default function SubscriptionPage() {
    const { locale, dict } = useDictionary();
    const t = dict.auth;

    const plans = [
        {
            id: "trial",
            name: locale === "es" ? "Prueba asistida" : "Assisted trial",
            price: locale === "es" ? "Sin coste inicial" : "No upfront cost",
            period: "",
            desc: locale === "es" ? "Validamos tu caso y configuramos la empresa contigo antes de empezar." : "We validate your use case and configure the workspace with you.",
            icon: Shield,
            color: "text-orange-500",
            bgClass: "bg-orange-500/10 border-orange-500/20",
            btnText: t.start_trial || "Solicitar evaluación",
            link: "/contact?reason=trial",
            features: locale === "es" ? [
                "1 Empresa / Colmena",
                "Entorno de evaluación durante 14 días",
                "Hasta 5 operarios activos",
                "Fichajes y control básico",
                "Sin tarjeta de crédito"
            ] : [
                "1 Company / Hive",
                "14-day evaluation workspace",
                "Up to 5 active workers",
                "Clock-in and basic shifts",
                "No credit card required"
            ]
        },
        {
            id: "pro",
            name: "Pro",
            price: "59€",
            period: locale === "es" ? "/ mes" : "/ month",
            desc: locale === "es" ? "Operaciones, equipos, ubicaciones, reservas, tareas, colaboradores y facturación." : "Operations, teams, locations, bookings, tasks, partners and invoicing.",
            icon: Flame,
            color: "text-accent",
            bgClass: "bg-accent/10 border-accent/20",
            btnText: t.select_plan || "Seleccionar Plan",
            link: "/subscription/checkout?plan=pro",
            popular: true,
            features: locale === "es" ? [
                "Hasta 10 usuarios activos",
                "Ubicaciones, clientes y tareas",
                "Reservas y colaboración entre empresas",
                "Presupuestos y facturación operativa",
                "Soporte por correo"
            ] : [
                "Up to 10 active users",
                "Locations, clients and tasks",
                "Bookings and company collaboration",
                "Quotes and operational invoicing",
                "Email support"
            ]
        }
    ];

    return (
        <main className="h-screen w-screen max-w-full overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-between p-4 py-6 md:p-8 relative bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-300">
            <AuthTopControls showThemeToggle={false} />

            <div className="w-full max-w-6xl z-10 py-4 lg:py-0 lg:my-auto flex flex-col">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mb-4 lg:mb-6 group w-fit"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {locale === "es" ? "Volver al inicio" : "Back to login"}
                </Link>

                <div className="text-center max-w-2xl mx-auto mb-6 lg:mb-8 flex flex-col items-center">
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-2">
                        {t.pricing_title || "Selecciona un plan de suscripción"}
                    </h1>
                    <p className="text-[var(--text-muted)] text-xs lg:text-sm mb-3">
                        {t.pricing_subtitle || "Evalúa WorkHive durante 14 días y elige el plan adecuado para tu operación."}
                    </p>
                    <div className="inline-flex items-center gap-1.5 bg-accent/10 text-accent dark:text-accent rounded-full px-4 py-1 border border-accent/20 text-[10px] sm:text-xs font-bold animate-pulse">
                        {locale === "es" ? "Precios de lanzamiento, sin permanencia" : "Launch pricing, cancel anytime"}
                    </div>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 xl:gap-8 items-stretch">
                    {plans.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div
                                key={p.id}
                                className={`rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5 xl:p-7 flex flex-col justify-between relative ui-motion duration-300 hover:translate-y-[-4px] hover:shadow-2xl ${
                                    p.popular ? "ring-2 ring-accent/50 shadow-lg" : ""
                                }`}
                            >
                                {p.popular && (
                                    <span className="absolute top-0 right-8 -translate-y-1/2 bg-accent dark:bg-accent text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                                        <Flame className="w-3.5 h-3.5" />
                                        {t.popular_tag || "Más popular"}
                                    </span>
                                )}

                                <div className="space-y-4 xl:space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl xl:text-2xl font-black text-[var(--text-main)]">{p.name}</h2>
                                        <div className={`p-2.5 rounded-2xl ${p.bgClass} ${p.color}`}>
                                            <Icon className="w-5.5 h-5.5" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight text-[var(--text-main)]">
                                                {p.price}
                                            </span>
                                            <span className="text-xs font-semibold text-[var(--text-muted)]">
                                                {p.period}
                                            </span>
                                            {p.id === "trial" && (
                                                <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
                                                    {t.trial_tag || "Sin tarjeta"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                        {p.desc}
                                    </p>

                                    <hr className="border-[var(--border-soft)]" />

                                    <ul className="space-y-2.5">
                                        {p.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
                                                <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                                                <span className="leading-tight">{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-6 pt-2 xl:mt-8">
                                    <Link
                                        href={p.link}
                                        className={`w-full block text-center font-bold rounded-xl py-3 text-xs ui-motion tracking-wider uppercase cursor-pointer ${
                                            p.popular
                                                ? "bg-[var(--text-main)] text-[var(--bg-primary)] hover:opacity-90 shadow-lg shadow-accent/10"
                                                : "bg-[var(--bg-tertiary)] border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[var(--text-main)]"
                                        }`}
                                    >
                                        {p.btnText}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
