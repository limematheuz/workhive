"use client"

import { Location } from "@/services/location.service"
import { Client } from "@/services/client.service"
import { TaskItem } from "@/services/task.service"
import { MapPin } from "lucide-react"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import * as React from "react"
import { LocationCard } from "./LocationCard"
import { LocationDetailDialog } from "./LocationDetailDialog"

interface LocationsGridProps {
    locations: Location[]
    clients: Client[]
    tasks: TaskItem[]
    onEdit: (location: Location) => void
    onDelete: (location: Location) => void
    onTasks: (location: Location) => void
}

// Soft brand-blue headers (readable in light + dark) — tokens from globals.css.
function getGradient(name: string): string {
    const gradients = [
        "linear-gradient(160deg, var(--brand-blue-sky) 0%, var(--brand-blue-mid) 100%)",
        "linear-gradient(160deg, var(--brand-blue-sky-deep) 0%, var(--brand-blue) 100%)",
        "linear-gradient(160deg, var(--brand-blue-mist) 0%, var(--brand-blue-bright) 100%)",
        "linear-gradient(160deg, var(--brand-blue-sky) 0%, var(--brand-blue) 100%)",
    ]
    const index = name.charCodeAt(0) % gradients.length
    return gradients[index]
}

export function LocationsGrid({ locations, clients, tasks, onEdit, onDelete, onTasks }: LocationsGridProps) {
    const { dict } = useDictionary()
    const { user } = useUser()
    const roleIsReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager"
    const [selectedLoc, setSelectedLoc] = React.useState<Location | null>(null)

    const getClientName = (clientId?: number | null) => {
        return clientId
            ? clients.find((c) => c.id === clientId)?.name ?? "Cliente no disponible"
            : "Sin cliente vinculado"
    }

    if (!locations || locations.length === 0) {
        return (
            <div className="billing-block flex flex-col items-center justify-center rounded-2xl px-5 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <MapPin className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{dict.locations.table.empty}</p>
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {locations.map((loc) => {
                    const locTasks = tasks ? tasks.filter(t => t.location_id === loc.id) : [];
                    const pending = locTasks.filter(t => t.status !== "completed").length;
                    const completed = locTasks.filter(t => t.status === "completed").length;
                    const ownerCompanyId = loc.owner_company_id ?? loc.managing_company_id;
                    const isReadOnly = roleIsReadOnly || (
                        ownerCompanyId != null && ownerCompanyId !== user?.company_id
                    );
                    return (
                        <LocationCard
                            key={loc.id}
                            location={loc}
                            clientName={getClientName(loc.client_id)}
                            activeLabel={dict.locations.table.active}
                            inactiveLabel={dict.locations.table.inactive}
                            gradient={getGradient(loc.name)}
                            onCardClick={() => setSelectedLoc(loc)}
                            onEdit={() => onEdit(loc)}
                            onDelete={() => onDelete(loc)}
                            onTasks={() => onTasks(loc)}
                            isReadOnly={isReadOnly}
                            pendingTasksCount={pending}
                            completedTasksCount={completed}
                        />
                    );
                })}
            </div>

            {/* Detail modal */}
            {selectedLoc && (
                <LocationDetailDialog
                    location={selectedLoc}
                    clientName={getClientName(selectedLoc.client_id)}
                    activeLabel={dict.locations.table.active}
                    inactiveLabel={dict.locations.table.inactive}
                    gradient={getGradient(selectedLoc.name)}
                    onClose={() => setSelectedLoc(null)}
                />
            )}

        </>
    )
}
