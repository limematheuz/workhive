"use client";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import type { Employee } from "@/services/staff.service";
import type { WorkCrew } from "@/services/service-planning.service";

export function CrewList({ crews, people, selected, select }: { crews: WorkCrew[]; people: Map<number, Employee>; selected?: number; select: (id: number) => void }) {
    const leader = (crew: WorkCrew) => people.get(crew.leader_employee_id ?? -1)?.name;
    return <DataListTable items={crews} getRowKey={crew => crew.id} selectedRowKey={selected} onRowClick={crew => select(crew.id)} desktopFrom="lg" persistenceKey="staff.crews"
        rowAriaLabel={crew => `Abrir equipo ${crew.name}`} header={{ title: "Equipos de la plantilla", countLabel: `${crews.length} equipos` }}
        columns={[{ key: "crew", label: "Equipo", className: "w-[40%]" }, { key: "leader", label: "Responsable", className: "w-[27%]" }, { key: "people", label: "Personas", className: "w-[15%]" }, { key: "state", label: "Estado", className: "w-[18%]" }]}
        renderDesktopRow={crew => [<div key="crew" className="space-y-1"><p className="break-words font-semibold">{crew.name}</p><p className="break-words text-xs text-muted-foreground">{crew.description}</p></div>,
            <span key="leader" className={leader(crew) ? "break-words" : "text-orange-700"}>{leader(crew) || "Pendiente"}</span>, <span key="people" className="tabular-nums">{crew.employee_ids.length}</span>, <span key="state" className="text-xs">{crew.is_active ? "Disponible" : "Archivado"}</span>]}
        renderCompactRow={crew => <div className="space-y-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{crew.name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{crew.description}</p></div><ChevronRight className="size-4 shrink-0 text-primary" aria-hidden="true"/></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs">{crew.employee_ids.length} personas</span><Badge variant="secondary">{crew.is_active ? "Disponible" : "Archivado"}</Badge></div>
            <p className={"border-t pt-3 text-xs " + (leader(crew) ? "text-muted-foreground" : "text-orange-700")}>Responsable · {leader(crew) || "Pendiente de asignar"}</p></div>}
        empty={<p className="text-sm text-muted-foreground">No hay equipos que coincidan con esta búsqueda.</p>}/>;
}
