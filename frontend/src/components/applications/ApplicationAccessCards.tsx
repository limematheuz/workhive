"use client";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Building2, Landmark, Loader2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isCurrentApplication, type ApplicationAccess, type ApplicationWorkspace } from "@/lib/application-access";

const icons = { internal: Building2, worker: Smartphone, client: BriefcaseBusiness, adviser: Landmark };
const publicEntries = [
    { kind: "internal" as const, title: "Administración de la empresa", description: "Planifica servicios y gestiona centros, personal, costes y resultados.", href: "/login?next=/accesos" },
    { kind: "worker" as const, title: "App del trabajador", description: "Tu jornada, trabajos asignados, fichaje, tareas, fotografías e incidencias.", href: "/worker" },
    { kind: "client" as const, title: "Portal del cliente", description: "Tus servicios, partes publicados, presupuestos y facturas en un mismo lugar.", href: "/portal-cliente" },
    { kind: "adviser" as const, title: "Portal de gestoría", description: "Acceso contable y laboral a las empresas que te han autorizado.", href: "/gestoria" },
];
export function PublicApplicationCards() {
    return <div className="grid gap-4 sm:grid-cols-2">{publicEntries.map(entry => {
        const Icon = icons[entry.kind];
        return <article key={entry.kind} className="flex min-w-0 flex-col rounded-2xl border bg-card p-6">
            <Icon aria-hidden="true" className="mb-5 size-6 text-accent" /><h2 className="text-lg font-semibold">{entry.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{entry.description}</p>
            <Button className="mt-6 self-start" variant="outline" asChild><Link href={entry.href} aria-label={`Entrar en ${entry.title}`}>Entrar<ArrowUpRight aria-hidden="true" className="size-4" /></Link></Button>
        </article>;
    })}</div>;
}
export function AuthorizedApplicationCards({ workspace, pending, onSelect }: {
    workspace: ApplicationWorkspace; pending: string | null; onSelect: (application: ApplicationAccess) => void;
}) {
    return <div className="grid gap-4 sm:grid-cols-2">{workspace.applications.map(entry => {
        const Icon = icons[entry.kind], current = isCurrentApplication(workspace, entry);
        return <article key={entry.key} className="flex min-w-0 flex-col rounded-2xl border bg-card p-6">
            <div className="mb-5 flex items-center justify-between gap-2"><Icon aria-hidden="true" className="size-6 shrink-0 text-accent" />{current && <Badge variant="outline">Acceso actual</Badge>}</div>
            <h2 className="break-words text-lg font-semibold">{entry.label}</h2>
            {entry.company_name && <p className="mt-1 break-words text-sm font-medium">{entry.company_name}</p>}
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{entry.description}</p>
            <Button className="mt-6 self-start" variant={current ? "outline" : "default"} disabled={pending !== null} onClick={() => onSelect(entry)} aria-label={`Abrir ${entry.label}${entry.company_name ? ` · ${entry.company_name}` : ""}`}>
                {pending === entry.key ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" />Abriendo…</> : <>Entrar<ArrowUpRight aria-hidden="true" className="size-4" /></>}
            </Button>
        </article>;
    })}</div>;
}
