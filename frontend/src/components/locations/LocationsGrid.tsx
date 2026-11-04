"use client"

import * as React from "react"
import {
    Pencil,
    Trash2,
} from "lucide-react"

import { ActionPopover } from "@/components/ui/action-popover"
import { LocationsListTable } from "./LocationsListTable"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import type { Client } from "@/services/client.service"
import type { Location } from "@/services/location.service"
import type { TaskItem } from "@/services/task.service"
import { LocationDetailDialog } from "./LocationDetailDialog"

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

    return <>
        <LocationsListTable
            locations={locations}
            tasks={tasks}
            getClientName={getClientName}
            renderActions={renderActions}
            onOpen={(location) => setSelectedLocationId(location.id)}
        />

        {selectedLocation && <LocationDetailDialog location={selectedLocation} clientName={getClientName(selectedLocation.client_id)} activeLabel={dict.locations.table.active} inactiveLabel={dict.locations.table.inactive} onClose={() => setSelectedLocationId(null)} onEdit={() => { setSelectedLocationId(null); onEdit(selectedLocation); }} />}
    </>
}
