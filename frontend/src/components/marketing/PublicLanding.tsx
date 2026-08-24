"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, UsersRound } from "lucide-react";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { useDictionary } from "@/lib/dictionary-context";

const COPY = {
    es: {
        eyebrow: "WORKHIVE · GESTIÓN PARA EMPRESAS DE SERVICIOS",
        title: "WorkHive coordina equipos, trabajos y facturación desde un solo lugar.",
        description:
            "WorkHive es una plataforma de gestión para empresas de limpieza y servicios de campo. Permite planificar trabajos, asignar responsables, registrar horas y preparar la facturación.",
        access: "Acceder a WorkHive",
        contact: "Contactar",
        purposeTitle: "Qué resuelve WorkHive",
        purposeDescription:
            "La plataforma conecta la operación diaria con el control administrativo para evitar hojas dispersas, duplicidades y tareas sin seguimiento.",
        features: [
            ["Planificación y equipos", "Ubicaciones, plantillas, tareas, checklists y asignación de trabajadores."],
            ["Control del trabajo", "Seguimiento de estados, fichaje de horas y evidencias del servicio."],
            ["Presupuestos y facturas", "Documentos comerciales y control financiero vinculados al trabajo realizado."],
        ],
        calendarTitle: "Integración opcional con Google Calendar",
        calendarDescription:
            "Un administrador puede conectar voluntariamente una Cuenta de Google para sincronizar tareas y reservas seleccionadas con un calendario dedicado de WorkHive. El acceso se solicita solo después de su consentimiento explícito y puede desconectarse en cualquier momento.",
        calendarPrivacy:
            "WorkHive usa estos datos únicamente para ofrecer la sincronización solicitada; no vende datos de Google ni los utiliza para publicidad.",
        learnPrivacy: "Consultar cómo protegemos los datos",
    },
    en: {
        eyebrow: "WORKHIVE · MANAGEMENT FOR SERVICE COMPANIES",
        title: "WorkHive coordinates teams, jobs and invoicing in one place.",
        description:
            "WorkHive is a management platform for cleaning and field-service companies. It helps them plan jobs, assign workers, track hours and prepare invoicing.",
        access: "Access WorkHive",
        contact: "Contact us",
        purposeTitle: "What WorkHive solves",
        purposeDescription:
            "The platform connects daily operations with administration to prevent scattered spreadsheets, duplicate work and untracked tasks.",
        features: [
            ["Planning and teams", "Locations, templates, tasks, checklists and worker assignments."],
            ["Work control", "Status tracking, time records and service evidence."],
            ["Quotes and invoices", "Commercial documents and financial control linked to completed work."],
        ],
        calendarTitle: "Optional Google Calendar integration",
        calendarDescription:
            "An administrator may voluntarily connect a Google Account to sync selected tasks and reservations with a dedicated WorkHive calendar. Access is requested only after consent and can be disconnected at any time.",
        calendarPrivacy:
            "WorkHive uses this data only to provide the requested synchronization; it does not sell Google data or use it for advertising.",
        learnPrivacy: "See how we protect data",
    },
} as const;

const FEATURE_ICONS = [UsersRound, CheckCircle2, FileText] as const;

export function PublicLanding() {
    const { locale } = useDictionary();
    const copy = COPY[locale];

    return (
        <AuthShell wide contentClassName="gap-10 pb-4 sm:gap-14">
            <header className="flex items-center justify-between gap-4">
                <AuthLogo className="w-40 sm:w-52" priority />
                <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-5 text-sm font-bold text-[var(--text-main)] shadow-sm ui-motion hover:border-accent/40"
                >
                    {copy.access}
                </Link>
            </header>

            <section className="grid items-center gap-8 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:pt-10">
                <div className="space-y-6">
                    <p className="text-xs font-black tracking-[0.22em] text-accent">{copy.eyebrow}</p>
                    <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                        {copy.title}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                        {copy.description}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link
                            href="/login"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white shadow-lg ui-motion hover:opacity-85"
                        >
                            {copy.access}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-6 text-sm font-bold text-[var(--text-main)] ui-motion hover:border-accent/40"
                        >
                            {copy.contact}
                        </Link>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-2xl sm:p-8">
                    <CalendarDays className="mb-8 h-10 w-10 text-accent" aria-hidden />
                    <h2 className="text-2xl font-black tracking-tight">{copy.calendarTitle}</h2>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{copy.calendarDescription}</p>
                    <p className="mt-4 border-t border-[var(--border-soft)] pt-4 text-xs leading-5 text-[var(--text-muted)]">
                        {copy.calendarPrivacy}
                    </p>
                    <Link href="/privacy" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline">
                        {copy.learnPrivacy}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-xl sm:p-8 lg:p-10">
                <div className="max-w-3xl">
                    <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{copy.purposeTitle}</h2>
                    <p className="mt-3 leading-7 text-[var(--text-muted)]">{copy.purposeDescription}</p>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {copy.features.map(([title, description], index) => {
                        const Icon = FEATURE_ICONS[index];
                        return (
                            <article key={title} className="rounded-3xl border border-[var(--border-soft)] p-5">
                                <Icon className="h-6 w-6 text-accent" aria-hidden />
                                <h3 className="mt-5 font-black">{title}</h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
                            </article>
                        );
                    })}
                </div>
            </section>
        </AuthShell>
    );
}
