import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalAccessStatus } from "./PortalAccessStatus";
import type { PortalWorkspace } from "@/services/portal-workspace.service";
export function AdviserPortalWorkspace({ advisers, enabled }: {
    advisers: PortalWorkspace["advisers"];
    enabled: boolean;
}) {
    return <section className="space-y-3 rounded-2xl border bg-card p-4" aria-labelledby="adviser-portal-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl"><h2 id="adviser-portal-title" className="flex items-center gap-2 text-base font-semibold"><Landmark className="size-4 text-accent"/>Portal de gestoría</h2><p className="mt-1 text-sm text-muted-foreground">Autoriza contabilidad y laboral de forma independiente. La gestoría puede consultar únicamente sus sociedades y áreas autorizadas, descargar documentación y entregar nóminas.</p></div>{enabled && <Button variant="outline" size="sm" asChild><Link href="/dashboard/advisory">Gestionar áreas y documentos<ArrowUpRight className="size-4"/></Link></Button>}</div>
        {!enabled ? <p className="text-sm text-orange-700 dark:text-orange-300">El portal de gestoría requiere activar el módulo en la suscripción de esta empresa.</p> : !advisers.length ? <div className="space-y-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200"><p>No hay gestorías autorizadas. Crea primero su cuenta en Profesionales externos y después autoriza sus áreas contable y laboral.</p><Button variant="outline" size="sm" asChild><Link href="/dashboard/external-network?tab=professionals">Crear o vincular cuenta de gestoría</Link></Button></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{advisers.map(adviser => <article key={adviser.id} className="space-y-3 rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 break-all text-sm">{adviser.name || adviser.email}</strong><PortalAccessStatus status={adviser.status}/></div><p className="break-all text-xs text-muted-foreground">{adviser.email}</p><div className="flex flex-wrap gap-2 text-xs"><span className={adviser.accounting ? "rounded-md bg-muted px-2 py-1" : "text-muted-foreground"}>Contabilidad: {adviser.accounting ? "autorizada" : "sin acceso"}</span><span className={adviser.payroll ? "rounded-md bg-muted px-2 py-1" : "text-muted-foreground"}>Laboral: {adviser.payroll ? "autorizada" : "sin acceso"}</span></div>{adviser.expires_at && <p className="text-xs text-muted-foreground">Caduca: {new Date(adviser.expires_at).toLocaleDateString("es-ES")}</p>}</article>)}</div>}
    </section>;
}
