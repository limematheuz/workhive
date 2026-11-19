"use client";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { formatDate } from "@/lib/format";
import { incidentStatusLabel } from "@/lib/quality-incident-status";
import { matchesIncidentFilter, type IncidentFilter } from "@/lib/record-deep-link";
import type { Location } from "@/services/location.service";
import type { QualityIncident } from "@/services/quality.service";

const FILTER_LABELS: Record<IncidentFilter, string> = { all: "Todos los estados", active: "Abiertas y en curso", open: "Abiertas", in_progress: "En curso", resolved: "Resueltas" };
export function QualityIncidentsList({ incidents, locations, filter, query, onFilter, onQuery, onOpen }: {
    incidents: QualityIncident[]; locations: Location[]; filter: IncidentFilter; query: string;
    onFilter: (filter: IncidentFilter) => void; onQuery: (query: string) => void; onOpen: (incident: QualityIncident) => void;
}) {
    const names = new Map(locations.map(location => [location.id, location.name]));
    const locationName = (id: number) => names.get(id) ?? `Ubicación #${id}`;
    const term = query.trim().toLocaleLowerCase("es");
    const visible = incidents.filter(incident => matchesIncidentFilter(incident.status, filter)
        && (!term || `${incident.title} ${locationName(incident.location_id)}`.toLocaleLowerCase("es").includes(term)));
    const status = (item: QualityIncident) => <Badge variant={item.status === "resolved" || item.status === "closed" ? "default" : "secondary"}>{incidentStatusLabel[item.status]}</Badge>;
    return <section className="space-y-3"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
        <label className="grid gap-1 text-sm font-medium">Buscar incidencia<Input value={query} maxLength={120} onChange={event => onQuery(event.target.value)} placeholder="Título o ubicación"/></label>
        <label className="grid gap-1 text-sm font-medium">Estado<FormSelect aria-label="Estado de las incidencias" value={filter} onValueChange={value => onFilter(value as IncidentFilter)}>
            {Object.entries(FILTER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </FormSelect></label></div>
        <DataListTable desktopFrom="lg" items={visible} getRowKey={item => item.id} onRowClick={onOpen} rowAriaLabel={item => `Abrir incidencia ${item.title}`}
            header={{ title: "Incidencias y acciones correctivas", subtitle: "Desviaciones de calidad y su seguimiento por ubicación.", countLabel: `${visible.length} de ${incidents.length} incidencias` }}
            columns={[{ key: "incident", label: "Incidencia", className: "w-[38%]" }, { key: "location", label: "Ubicación", className: "w-[27%]" }, { key: "actions", label: "Acciones", className: "w-[17%] text-right" }, { key: "status", label: "Estado", className: "w-[18%] text-right" }]}
            renderDesktopRow={item => [<span key="incident" className="font-semibold">{item.title}</span>, <span key="location" className="text-muted-foreground">{locationName(item.location_id)}</span>,
                <span key="actions" className="block text-right tabular-nums">{item.corrective_actions.length} acciones · {item.evidence.length} fotos</span>, <span key="status" className="block text-right">{status(item)}</span>]}
            renderCompactRow={item => <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{locationName(item.location_id)} · {item.corrective_actions.length} acciones · {item.evidence.length} fotos · {formatDate(item.created_at)}</p></div>{status(item)}</div>}
            empty={<p className="text-sm text-muted-foreground">{incidents.length ? "No hay incidencias que coincidan con estos filtros." : "Todavía no hay incidencias registradas."}</p>}/>
    </section>;
}
