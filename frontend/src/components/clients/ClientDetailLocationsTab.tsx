"use client";

import { ChevronRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { getLocationTypeLabel, normalizeLocationType } from "@/domain/locations/location-type";
import type { Location } from "@/services/location.service";

const LOCATION_TYPE_LABELS = { private: "Particular", real_estate: "Inmueble", business: "Empresa", exterior: "Exterior", other: "Otro" };

type ClientDetailLocationsTabProps = { locations: Location[]; onViewLocationTasks: (location: Location) => void; onClose: () => void; };

export function ClientDetailLocationsTab({ locations, onViewLocationTasks, onClose }: ClientDetailLocationsTabProps) {
    const pagination = useDataTablePagination(locations, 10);
    const openTasks = (location: Location) => { onClose(); onViewLocationTasks(location); };
    return <section className="billing-surface overflow-hidden rounded-[22px]">
        <header className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold text-[var(--text-main)]">Ubicaciones del cliente</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Localiza cada centro y abre sus tareas directamente.</p></div><p className="text-sm font-medium text-[var(--text-muted)]">{locations.length} {locations.length === 1 ? "ubicación" : "ubicaciones"}</p></header>
        {locations.length === 0 ? <div className="px-5 py-16 text-center"><MapPin className="mx-auto size-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Este cliente todavía no tiene ubicaciones.</p></div> : <DataListTable
            variant="plain" desktopFrom="lg" items={pagination.pageItems} getRowKey={(location) => location.id}
            columns={[{ key: "location", label: "Ubicación" }, { key: "address", label: "Dirección" }, { key: "type", label: "Tipo" }, { key: "actions", label: "Acciones", className: "text-right" }]}
            gridClassName="grid-cols-[minmax(11rem,1.2fr)_minmax(14rem,1.6fr)_7rem_7rem]"
            renderDesktopRow={(location) => <><div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><MapPin className="size-4" /></span><span className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</span></div><span className="truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</span><LocationTypeBadge location={location} /><div className="text-right"><Button type="button" variant="outline" size="xs" onClick={() => openTasks(location)}>Ver tareas<ChevronRight /></Button></div></>}
            renderCompactRow={(location) => <div className="space-y-3"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><MapPin className="size-4" /></span><span className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</span></div><LocationTypeBadge location={location} /></div><p className="border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-muted)]">{location.address}, {location.city}</p><Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openTasks(location)}>Ver tareas<ChevronRight /></Button></div>}
            footer={<DataTablePagination page={pagination.page} totalItems={locations.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, locations.length)} de ${locations.length} ubicaciones`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />}
        />}
    </section>;
}

function LocationTypeBadge({ location }: { location: Location }) {
    return <Badge className={normalizeLocationType(location.location_type) === "real_estate" ? "border border-accent/20 bg-accent/10 text-[10px] text-accent" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-muted)]"}>{getLocationTypeLabel(location.location_type, LOCATION_TYPE_LABELS)}</Badge>;
}
