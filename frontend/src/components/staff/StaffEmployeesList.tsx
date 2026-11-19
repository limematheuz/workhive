"use client";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { formatCurrency } from "@/lib/format";
import { hourly, monthly, type Employee } from "@/services/staff.service";

const hours = (person: Employee) => Number(person.monthly_hours).toLocaleString("es-ES") + " h/mes";
const state = (person: Employee) => <Badge variant="secondary" className={"max-w-full whitespace-normal px-1.5 text-[10px] " + (person.profile.state === "Activo" || person.profile.state === "Baja" ? "" : "border-orange-300 bg-orange-50 text-orange-800")}>{person.profile.state}</Badge>;
function Identity({ person }: { person: Employee }) {
    return <div className="min-w-0 space-y-1"><p className="break-words text-sm font-semibold">{person.name}</p>
        <p className="break-words text-xs text-muted-foreground">{person.position || "Cargo pendiente"}</p>
        {person.profile.identifier && <p className="text-[11px] text-muted-foreground">Documento ····{person.profile.identifier.slice(-4)}</p>}</div>;
}
export function StaffEmployeesList({ people, selected, select }: { people: Employee[]; selected?: number; select: (id: number) => void }) {
    return <DataListTable items={people} getRowKey={person => person.id} selectedRowKey={selected} onRowClick={person => select(person.id)}
        rowAriaLabel={person => `Abrir ficha de ${person.name}`} desktopFrom="lg" persistenceKey="staff.employees" className="min-w-0 bg-card"
        header={{ title: "Plantilla", countLabel: `${people.length} trabajadores` }}
        columns={[{ key: "person", label: "Trabajador", className: "w-[29%]" }, { key: "team", label: "Equipo", className: "w-[17%]" },
            { key: "cost", label: "Coste de referencia", className: "w-[21%]" }, { key: "contract", label: "Contrato y horas", className: "w-[19%]" }, { key: "state", label: "Estado", className: "w-[14%] px-1" }]}
        renderDesktopRow={person => [<Identity key="person" person={person}/>, <span key="team" className="break-words text-sm">{person.team || <span className="text-orange-700">Sin equipo</span>}</span>,
            <div key="cost" className="space-y-1"><p className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrency(monthly(person))}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{formatCurrency(hourly(person))}/h</p></div>,
            <div key="contract" className="space-y-1 text-xs"><p className={!person.profile.contract ? "text-orange-700" : ""}>{person.profile.contract || "Pendiente"}</p><p className="whitespace-nowrap text-muted-foreground">{hours(person)}</p></div>, <span key="state">{state(person)}</span>]}
        renderCompactRow={person => <div className="space-y-3"><div className="flex items-start justify-between gap-3"><Identity person={person}/><ChevronRight className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true"/></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{person.team || "Sin equipo"}</span>{state(person)}</div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs"><div><p className="text-muted-foreground">Coste mensual de referencia</p><p className="mt-1 whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrency(monthly(person))}</p><p className="mt-1 text-muted-foreground">{formatCurrency(hourly(person))}/h</p></div>
                <div><p className="text-muted-foreground">Contrato y jornada</p><p className="mt-1 break-words">{person.profile.contract || "Contrato pendiente"}</p><p className="mt-1 text-muted-foreground">{hours(person)}</p></div></div></div>}
        empty={<p className="text-sm text-muted-foreground">No hay trabajadores que coincidan con estos filtros.</p>}/>;
}
