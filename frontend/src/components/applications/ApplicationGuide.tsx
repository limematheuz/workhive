"use client";
import { useState } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApplicationKind } from "@/lib/auth-routes";

const guides = {
    worker: [
        { title: "1. Consulta tu siguiente servicio", text: "En Hoy verás los trabajos asignados. Abre el servicio para consultar la dirección, el horario y las instrucciones.", href: "/worker", action: "Abrir Hoy" },
        { title: "2. Registra tu jornada", text: "Fichaje permite iniciar y finalizar tu jornada y consultar tus registros. Una corrección conserva el registro original y sigue su proceso de aprobación.", href: "/worker/clock", action: "Abrir Fichaje" },
        { title: "3. Sigue el checklist y documenta el resultado", text: "En Mis tareas puedes abrir un servicio, revisar sus espacios y añadir las evidencias admitidas. Si trabajas sin conexión, comprueba qué partes siguen pendientes de sincronizar.", href: "/worker/jobs", action: "Abrir Mis tareas" },
    ],
    client: [
        { title: "Comprueba el espacio compartido", text: "El proveedor y el cliente activos delimitan qué documentos y trabajos puedes consultar. Cambiar de espacio requiere otro acceso autorizado.", href: "/portal-cliente", action: "Abrir mi portal" },
        { title: "Responde a lo que requiere tu atención", text: "Un presupuesto pendiente puede aceptarse cuando el acceso lo permite. La validación de una inspección y la recepción de un documento son acciones diferentes.", href: "/portal-cliente", action: "Consultar pendientes" },
    ],
    adviser: [
        { title: "Selecciona una empresa autorizada", text: "Cada acceso delimita la empresa y las áreas de contabilidad o laboral disponibles. No todas las empresas comparten las mismas áreas.", href: "/gestoria", action: "Abrir gestoría" },
        { title: "Consulta el periodo y los documentos de origen", text: "Revisa el periodo antes de exportar. Las peticiones de información indican quién tiene que responder. El cierre de periodos requiere una autorización específica.", href: "/gestoria", action: "Consultar mi espacio" },
    ],
};

export function ApplicationGuide({ kind }: { kind: ApplicationKind }) {
    const [open, setOpen] = useState(false);
    return <><Button variant="ghost" size="icon" aria-label="Ayuda de este acceso" onClick={() => setOpen(true)}><CircleHelp className="size-4" aria-hidden="true" /></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto" confirmDiscard={false}><DialogHeader><DialogTitle>Ayuda de tu espacio</DialogTitle><DialogDescription>Puedes cerrar esta guía y retomarla desde Ayuda cuando lo necesites.</DialogDescription></DialogHeader><div className="space-y-3">{guides[kind].map(step => <section key={step.title} className="rounded-xl border p-4"><h2 className="text-base font-semibold">{step.title}</h2><p className="my-2 text-sm text-muted-foreground">{step.text}</p><Button variant="outline" asChild><Link href={step.href} onClick={() => setOpen(false)}>{step.action}</Link></Button></section>)}</div></DialogContent></Dialog></>;
}
