"use client";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { hourly, monthly, type Employee } from "@/services/staff.service";
import type { WorkCrew } from "@/services/service-planning.service";

export function CrewDetail({ crew, people, close, edit }: { crew: WorkCrew; people: Employee[]; close: () => void; edit?: () => void }) {
    return <div className="space-y-4 p-4 text-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{crew.name}</h2><p className="mt-1 text-xs text-muted-foreground">{people.length} miembros · {crew.is_active ? "Disponible" : "Archivado"}</p></div><Button size="icon" variant="ghost" onClick={close} aria-label="Cerrar equipo"><X className="size-4"/></Button></div>
        {crew.description && <p className="break-words text-muted-foreground">{crew.description}</p>}
        <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3"><div><dt className="text-xs text-muted-foreground">Coste mensual de referencia</dt><dd className="mt-1 whitespace-nowrap font-semibold tabular-nums">{formatCurrency(people.reduce((sum, person) => sum + monthly(person), 0))}</dd></div><div><dt className="text-xs text-muted-foreground">Horas contratadas / mes</dt><dd className="mt-1 font-semibold">{people.reduce((sum, person) => sum + Number(person.monthly_hours), 0).toLocaleString("es-ES")} h</dd></div></dl>
        <section><h3 className="mb-2 font-semibold">Trabajadores del equipo</h3>{people.length ? <ul className="divide-y">{people.map(person => <li key={person.id} className="flex justify-between gap-3 py-3"><div className="min-w-0"><Link className="break-words font-medium text-primary underline underline-offset-2" href={`/dashboard/plantilla/trabajadores?employeeId=${person.id}`}>{person.name}</Link><p className="mt-1 text-xs text-muted-foreground">{person.position}</p></div><span className="shrink-0 whitespace-nowrap text-xs tabular-nums">{formatCurrency(hourly(person))}/h</span></li>)}</ul> : <p className="text-orange-700">Pendiente de asignar trabajadores.</p>}</section>
        {edit && <Button size="sm" variant="outline" className="w-full" onClick={edit}>Editar equipo</Button>}
        <Button asChild variant="outline" className="w-full"><Link href="/dashboard/planificar">Abrir planificación</Link></Button>
    </div>;
}
