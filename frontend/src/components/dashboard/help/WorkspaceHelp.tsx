"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, CircleHelp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigationProvider";
import { useUser } from "@/lib/user-context";
import { COMPANY_ONBOARDING_REQUESTED, shouldShowCompanyOnboarding } from "@/domain/onboarding/cleaning-onboarding";

const helpLinks = [
    { href: "/dashboard/locations", title: "Preparar una ubicación", text: "Registra el centro y los espacios que se limpian por separado. Sus tareas se podrán seleccionar al planificar un trabajo." },
    { href: "/dashboard/planificar", title: "Planificar y asignar un servicio", text: "Elige cliente, ubicación y espacios. Puedes repartir cada espacio entre trabajadores y equipos, o crear un trabajo puntual con dirección propia." },
    { href: "/dashboard/tasks", title: "Consultar y completar el trabajo", text: "Busca el servicio, abre su detalle y sigue las instrucciones y el checklist. Las vistas guardadas conservan tus filtros en este dispositivo." },
    { href: "/dashboard/time-corrections", title: "Revisar o corregir fichajes", text: "Consulta el registro de jornada y solicita o resuelve una corrección según tus permisos." },
    { href: "/dashboard/invoices", title: "Pasar de trabajo terminado a factura", text: "En Trabajos hechos encontrarás los servicios que puedes facturar. Abre una factura para comprobar total, cobrado y saldo." },
    { href: "/dashboard/organization", title: "Gestionar accesos al software", text: "Invita usuarios y configura sus permisos. Los trabajadores y equipos laborales se gestionan por separado en Plantilla." },
    { href: "/dashboard/portals", title: "Compartir con clientes y gestoría", text: "Crea un acceso limitado a la empresa, documentos y áreas que cada persona puede consultar." },
];

export function WorkspaceHelp({ expanded = true }: { expanded?: boolean }) {
    const [open, setOpen] = useState(false);
    const { navigation, canAccessPath, loading, error } = useWorkspaceNavigation();
    const { user } = useUser();
    const links = helpLinks.filter(link => canAccessPath(link.href) && navigation.visibleNavLinks.some(item => item.href === link.href));
    function resume() {
        if (!user) return;
        localStorage.setItem(`workhive_onboarding_forced_${user.id}`, "true");
        setOpen(false);
        window.dispatchEvent(new Event(COMPANY_ONBOARDING_REQUESTED));
    }
    return <><Button variant="ghost" className="w-full justify-start px-2" aria-label="Ayuda de WorkHive" onClick={() => setOpen(true)}><CircleHelp className="size-4 shrink-0" aria-hidden="true" />{expanded && "Ayuda"}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto" confirmDiscard={false}><DialogHeader><DialogTitle>Ayuda de WorkHive</DialogTitle><DialogDescription>Encuentra el siguiente paso según los apartados a los que tienes acceso.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">La empresa activa aparece en la barra superior. Las cifras y búsquedas respetan sus permisos. Usa la búsqueda para localizar un nombre, una dirección o una referencia.</p>{loading ? <p role="status">Cargando tus accesos…</p> : error ? <p role="alert" className="text-sm text-[var(--alert-warning-text)]">No se pudieron comprobar todos tus accesos. Actualiza el menú y vuelve a abrir la ayuda.</p> : <div className="space-y-2">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl border p-4 hover:bg-[var(--brand-blue-soft)]"><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{link.title}</h2><p className="mt-1 text-sm text-muted-foreground">{link.text}</p></div><ArrowUpRight className="size-4 shrink-0 text-accent" aria-hidden="true" /></Link>)}</div>}{user && shouldShowCompanyOnboarding(user) && <Button variant="outline" onClick={resume}>Retomar guía de configuración</Button>}<p className="text-xs text-muted-foreground">Una incidencia es un problema detectado durante el servicio. Un parte documenta lo realizado. El fichaje registra tu jornada. Las acciones y documentos disponibles dependen del permiso de cada persona.</p></DialogContent></Dialog></>;
}
