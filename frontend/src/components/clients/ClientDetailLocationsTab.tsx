"use client";

import { ChevronRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { getLocationTypeLabel, normalizeLocationType } from "@/domain/locations/location-type";
import type { Location } from "@/services/location.service";

const LOCATION_TYPE_LABELS = {
    private: "Particular",
    real_estate: "Inmueble",
    business: "Empresa",
    exterior: "Exterior",
    other: "Otro",
};

type ClientDetailLocationsTabProps = {
    locations: Location[];
    onViewLocationTasks: (location: Location) => void;
    onClose: () => void;
};

export function ClientDetailLocationsTab({ locations, onViewLocationTasks, onClose }: ClientDetailLocationsTabProps) {
    const openTasks = (location: Location) => {
        onClose();
        onViewLocationTasks(location);
    };

    return (
        <DataListTable
            variant="plain"
            items={locations}
            getRowKey={(location) => location.id}
            gridClassName="grid-cols-[minmax(13rem,1.1fr)_minmax(15rem,1fr)_7rem_7rem]"
            header={{
                title: "Ubicaciones del cliente",
                subtitle: "Localiza cada centro y abre sus tareas directamente.",
                countLabel: `${locations.length} ${locations.length === 1 ? "ubicación" : "ubicaciones"}`,
            }}
            columns={[
                { key: "location", label: "Ubicación" },
                { key: "address", label: "Dirección" },
                { key: "type", label: "Tipo" },
                { key: "actions", label: "", className: "text-right" },
            ]}
            empty={(
                <><MapPin className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-sm text-[var(--text-muted)]">Este cliente todavía no tiene ubicaciones.</p></>
            )}
            renderCompactRow={(location) => (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</p></div>
                    <Button type="button" variant="outline" size="xs" onClick={() => openTasks(location)}>Tareas<ChevronRight aria-hidden="true" /></Button>
                </div>
            )}
            renderDesktopRow={(location) => (
                <>
                    <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><MapPin className="h-4 w-4" /></span><span className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</span></div>
                    <span className="truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</span>
                    <Badge className={`w-fit text-[10px] ${normalizeLocationType(location.location_type) === "real_estate" ? "border border-accent/20 bg-accent/10 text-accent" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>{getLocationTypeLabel(location.location_type, LOCATION_TYPE_LABELS)}</Badge>
                    <div className="flex justify-end"><Button type="button" variant="outline" size="xs" onClick={() => openTasks(location)}>Ver tareas<ChevronRight aria-hidden="true" /></Button></div>
                </>
            )}
        />
    );
}
