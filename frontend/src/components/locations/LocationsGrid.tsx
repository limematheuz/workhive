"use client"

import * as React from "react"
import {
    Building2,
    CheckCircle2,
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

export function LocationsGrid({ locations, clients, tasks, onEdit, onDelete }: LocationsGridProps) {
    const { dict } = useDictionary()
    const workspace = dict.locations.workspace
    const { user } = useUser()
    const [selectedLocationId, setSelectedLocationId] = React.useState<number | null>(null)
    const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null
    const readOnlyRole = user?.role?.name === "viewer" || user?.role?.name === "manager"

    const getClientName = (clientId?: number | null) => clientId
        ? clients.find((client) => client.id === clientId)?.name ?? workspace.client_unavailable
        : workspace.no_client

    const locationTasks = (locationId: number) => tasks.filter((task) => task.location_id === locationId)

    const renderActions = (location: Location) => {
        const ownerCompanyId = location.owner_company_id ?? location.managing_company_id
        const isReadOnly = readOnlyRole || (ownerCompanyId != null && ownerCompanyId !== user?.company_id)

        return (
            <div onClick={(event) => event.stopPropagation()}>
                <ActionPopover
                    align="end"
                    triggerLabel={workspace.actions_for.replace("{name}", location.name)}
                    options={[
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
        const siteType = location.profile?.site_type?.replaceAll("_", " ") || workspace.other_type

        return <>
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.className}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{location.profile?.internal_code || `LOC-${location.id}`}</p></div>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-medium">{getClientName(location.client_id)}</span></div>
            <span className={`w-fit rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${visual.className}`}>{siteType}</span>
            <div className="flex min-w-0 items-start gap-1.5 text-xs text-[var(--text-muted)]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span className="line-clamp-2">{location.address}, {location.city}</span></div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-xs font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" />{taskItems.length}<span className="text-[var(--text-muted)]">({pendingTasks} {workspace.pending_tasks})</span></span>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${location.is_active ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]" : "bg-slate-500/10 text-slate-600"}`}><CheckCircle2 className="h-3.5 w-3.5" />{location.is_active ? dict.locations.table.active : dict.locations.table.inactive}</span>
            {renderActions(location)}
        </>
    }

    const renderCompactRow = (location: Location) => {
        const taskItems = locationTasks(location.id)
        const visual = getLocationTypeVisual(location.profile?.site_type)
        const Icon = visual.icon

        return <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.className}`}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{location.name}</p><p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{location.address}, {location.city}</p><div className="mt-2 flex items-center gap-2"><span className="text-xs text-[var(--text-muted)]">{taskItems.length} {workspace.tasks}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${location.is_active ? "border border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]" : "bg-slate-500/10 text-slate-600"}`}>{location.is_active ? dict.locations.table.active : dict.locations.table.inactive}</span></div></div>
            {renderActions(location)}
        </div>
    }

    return <>
        <DataListTable
            variant="plain"
            items={locations}
            getRowKey={(location) => location.id}
            columns={[
                { key: "location", label: dict.locations.title, className: "w-[23%]" },
                { key: "client", label: dict.locations.form.client_label, className: "w-[16%]" },
                { key: "type", label: dict.locations.table.type, className: "w-[12%]" },
                { key: "address", label: dict.locations.table.address, className: "w-[25%]" },
                { key: "tasks", label: workspace.tasks, className: "w-[12%]" },
                { key: "status", label: dict.locations.table.status, className: "w-[8%]" },
                { key: "actions", label: <span className="sr-only">Acciones</span>, className: "w-[4%] text-right" },
            ]}
            desktopFrom="lg"
            renderDesktopRow={renderDesktopRow}
            renderCompactRow={renderCompactRow}
            onRowClick={(location) => setSelectedLocationId(location.id)}
            rowAriaLabel={(location) => workspace.view_location.replace("{name}", location.name)}
            empty={<div className="flex flex-col items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent"><MapPin className="h-6 w-6" /></span><p className="text-sm font-medium text-[var(--text-muted)]">{dict.locations.table.empty}</p></div>}
        />

        {selectedLocation && <LocationDetailDialog location={selectedLocation} clientName={getClientName(selectedLocation.client_id)} activeLabel={dict.locations.table.active} inactiveLabel={dict.locations.table.inactive} onClose={() => setSelectedLocationId(null)} onEdit={() => { setSelectedLocationId(null); onEdit(selectedLocation); }} />}
    </>
}
