"use client"

import { Location } from "@/services/location.service"
import { Client } from "@/services/client.service"
import { TaskItem } from "@/services/task.service"
import { Building2, CheckCircle2, ListChecks, MapPin, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { ActionPopover } from "@/components/ui/action-popover"
import { LocationDetailDialog } from "./LocationDetailDialog"
import { getLocationTypeVisual } from "./location-visuals"

interface LocationsGridProps {
    locations: Location[]
    clients: Client[]
    tasks: TaskItem[]
    onEdit: (location: Location) => void
    onDelete: (location: Location) => void
    onTasks: (location: Location) => void
}

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
    const activeLabel = dict.locations.table.active
    const inactiveLabel = dict.locations.table.inactive

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
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]">
                <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full text-left">
                        <thead className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]">
                            <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                <th className="px-5 py-3.5">Ubicación</th>
                                <th className="px-4 py-3.5">Cliente</th>
                                <th className="px-4 py-3.5">Tipo</th>
                                <th className="px-4 py-3.5">Dirección</th>
                                <th className="px-4 py-3.5 text-center">Tareas</th>
                                <th className="px-4 py-3.5">Estado</th>
                                <th className="w-14 px-4 py-3.5"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-soft)]">
                            {locations.map((loc) => {
                                const locTasks = tasks ? tasks.filter((task) => task.location_id === loc.id) : [];
                                const pending = locTasks.filter((task) => task.status !== "completed").length;
                                const siteType = loc.profile?.site_type;
                                const visual = getLocationTypeVisual(siteType);
                                const TypeIcon = visual.icon;
                    const ownerCompanyId = loc.owner_company_id ?? loc.managing_company_id;
                    const isReadOnly = roleIsReadOnly || (
                        ownerCompanyId != null && ownerCompanyId !== user?.company_id
                    );
                                return (
                                    <tr
                                        key={loc.id}
                                        onClick={() => setSelectedLoc(loc)}
                                        className="group cursor-pointer transition-colors hover:bg-accent/[0.035]"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex min-w-[13rem] items-center gap-3">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.className}`}>
                                                    <TypeIcon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-[var(--text-main)] group-hover:text-accent">{loc.name}</p>
                                                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{loc.profile?.internal_code || `LOC-${loc.id}`}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5"><div className="flex max-w-44 items-center gap-2 text-xs text-[var(--text-muted)]"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-medium">{getClientName(loc.client_id)}</span></div></td>
                                        <td className="px-4 py-3.5"><span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${visual.className}`}>{siteType?.replaceAll("_", " ") || "Otro"}</span></td>
                                        <td className="px-4 py-3.5"><div className="flex max-w-60 items-start gap-1.5 text-xs text-[var(--text-muted)]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span className="line-clamp-2">{loc.address}, {loc.city}</span></div></td>
                                        <td className="px-4 py-3.5 text-center"><div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-2 py-1 text-xs font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" />{locTasks.length}<span className="text-[var(--text-muted)]">({pending} pendientes)</span></div></td>
                                        <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${loc.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}><CheckCircle2 className="h-3.5 w-3.5" />{loc.is_active ? activeLabel : inactiveLabel}</span></td>
                                        <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                            <ActionPopover
                                                align="end"
                                                trigger={<Button variant="ghost" size="icon-sm" className="rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)]"><MoreHorizontal className="h-4 w-4" /></Button>}
                                                options={[
                                                    { label: dict.locations?.sheet?.tab_templates || "Servicios", icon: ListChecks, onClick: () => onTasks(loc) },
                                                    ...(!isReadOnly ? [
                                                        { label: dict.locations.table.edit, icon: Pencil, onClick: () => onEdit(loc), variant: "edit" as const },
                                                        { label: dict.locations.table.delete, icon: Trash2, onClick: () => onDelete(loc), variant: "delete" as const },
                                                    ] : []),
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
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
