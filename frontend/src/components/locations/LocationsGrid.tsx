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

// Generates a unique, subtle gradient from the location name.
function getGradient(name: string): string {
    const gradients = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
        "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
        "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
        "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)",
        "linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)",
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
            <div className="flex flex-col items-center justify-center p-16 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-soft)]">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 opacity-40"
                    style={{ background: "var(--sidebar-active-bg)" }}
                >
                    <MapPin className="w-8 h-8" style={{ color: "var(--sidebar-active-text)" }} />
                </div>
                <p className="text-[var(--text-muted)] text-lg font-medium">{dict.locations.table.empty}</p>
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
