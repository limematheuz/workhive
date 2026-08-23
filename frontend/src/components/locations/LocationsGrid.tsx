"use client"

import * as React from "react"
import {
    Building2,
    CheckCircle2,
    Eye,
    ListChecks,
    MapPin,
    Pencil,
    Trash2,
} from "lucide-react"

import { ActionPopover } from "@/components/ui/action-popover"
import { DataListTable } from "@/components/ui/data-list-table"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import type { Client } from "@/services/client.service"
import type { Location } from "@/services/location.service"
import type { TaskItem } from "@/services/task.service"
import { LocationDetailDialog } from "./LocationDetailDialog"
import { getLocationTypeVisual } from "./location-visuals"

interface LocationsGridProps {
    locations: Location[]
    clients: Client[]
    tasks: TaskItem[]
    onEdit: (location: Location) => void
    onDelete: (location: Location) => void
}

const GRID_CLASS = "grid-cols-[minmax(12rem,1.35fr)_minmax(9rem,1fr)_minmax(6.5rem,.7fr)_minmax(13rem,1.2fr)_minmax(10rem,.8fr)_minmax(7rem,.65fr)_2.25rem]"

function getGradient(name: string): string {
    const gradients = [
        "linear-gradient(160deg, var(--brand-blue-sky) 0%, var(--brand-blue-mid) 100%)",
        "linear-gradient(160deg, var(--brand-blue-sky-deep) 0%, var(--brand-blue) 100%)",
        "linear-gradient(160deg, var(--brand-blue-mist) 0%, var(--brand-blue-bright) 100%)",
        "linear-gradient(160deg, var(--brand-blue-sky) 0%, var(--brand-blue) 100%)",
    ]
    return gradients[name.charCodeAt(0) % gradients.length]
}

export function LocationsGrid({ locations, clients, tasks, onEdit, onDelete }: LocationsGridProps) {
    const { dict } = useDictionary()
    const { user } = useUser()
    const [selectedLocation, setSelectedLocation] = React.useState<Location | null>(null)
    const readOnlyRole = user?.role?.name === "viewer" || user?.role?.name === "manager"

    const getClientName = (clientId?: number | null) => clientId
        ? clients.find((client) => client.id === clientId)?.name ?? "Cliente no disponible"
        : "Sin cliente vinculado"

    const locationTasks = (locationId: number) => tasks.filter((task) => task.location_id === locationId)

    const renderActions = (location: Location) => {
        const ownerCompanyId = location.owner_company_id ?? location.managing_company_id
        const isReadOnly = readOnlyRole || (ownerCompanyId != null && ownerCompanyId !== user?.company_id)

        return (
            <div onClick={(event) => event.stopPropagation()}>
                <ActionPopover
                    align="end"
                    triggerLabel={`Acciones para ${location.name}`}
                    options={[
                        {
                            label: "Ver detalle",
                            icon: Eye,
                            onClick: () => setSelectedLocation(location),
                        },
                        ...(!isReadOnly ? [
                            {
                                label: dict.locations.table.edit,
                                icon: Pencil,
                                onClick: () => onEdit(location),
                                variant: "edit" as const,
                            },
                            {
                                label: dict.locations.table.delete,
                                icon: Trash2,
                                onClick: () => onDelete(location),
                                variant: "delete" as const,
                            },
                        ] : []),
                    ]}
                />
            </div>
        )
    }

    const renderDesktopRow = (location: Location) => {
        const taskItems = locationTasks(location.id)
        const pendingTasks = taskItems.filter((task) => task.status !== "completed").length
        const visual = getLocationTypeVisual(location.profile?.site_type)
        const Icon = visual.icon
        const siteType = location.profile?.site_type?.replaceAll("_", " ") || "Otro"

        return <>
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.className}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{location.profile?.internal_code || `LOC-${location.id}`}</p></div>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-medium">{getClientName(location.client_id)}</span></div>
            <span className={`w-fit rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${visual.className}`}>{siteType}</span>
            <div className="flex min-w-0 items-start gap-1.5 text-xs text-[var(--text-muted)]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span className="line-clamp-2">{location.address}, {location.city}</span></div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-xs font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" />{taskItems.length}<span className="text-[var(--text-muted)]">({pendingTasks} pendientes)</span></span>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${location.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}><CheckCircle2 className="h-3.5 w-3.5" />{location.is_active ? dict.locations.table.active : dict.locations.table.inactive}</span>
            {renderActions(location)}
        </>
    }

    const renderCompactRow = (location: Location) => {
        const taskItems = locationTasks(location.id)
        const visual = getLocationTypeVisual(location.profile?.site_type)
        const Icon = visual.icon

        return <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.className}`}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</p><div className="mt-2 flex items-center gap-2"><span className="text-xs text-[var(--text-muted)]">{taskItems.length} tareas</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${location.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}>{location.is_active ? dict.locations.table.active : dict.locations.table.inactive}</span></div></div>
            {renderActions(location)}
        </div>
    }

    return <>
        <DataListTable
            variant="plain"
            items={locations}
            getRowKey={(location) => location.id}
            columns={[
                { key: "location", label: "Ubicación" },
                { key: "client", label: "Cliente" },
                { key: "type", label: "Tipo" },
                { key: "address", label: "Dirección" },
                { key: "tasks", label: "Tareas" },
                { key: "status", label: "Estado" },
                { key: "actions", label: <span className="sr-only">Acciones</span> },
            ]}
            gridClassName={GRID_CLASS}
            desktopFrom="lg"
            renderDesktopRow={renderDesktopRow}
            renderCompactRow={renderCompactRow}
            onRowClick={onEdit}
            rowAriaLabel={(location) => `Editar ${location.name}`}
            empty={<div className="flex flex-col items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent"><MapPin className="h-6 w-6" /></span><p className="text-sm font-medium text-[var(--text-muted)]">{dict.locations.table.empty}</p></div>}
        />

        {selectedLocation && <LocationDetailDialog location={selectedLocation} clientName={getClientName(selectedLocation.client_id)} activeLabel={dict.locations.table.active} inactiveLabel={dict.locations.table.inactive} gradient={getGradient(selectedLocation.name)} onClose={() => setSelectedLocation(null)} onEdit={() => { setSelectedLocation(null); onEdit(selectedLocation); }} />}
    </>
}
