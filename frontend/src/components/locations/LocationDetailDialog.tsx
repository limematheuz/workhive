"use client"

import { useEffect, useState } from "react"
import { Building2, Layers3, ListChecks, PencilLine } from "lucide-react"
import { Location, LocationService } from "@/services/location.service"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import { isSuperadmin } from "@/domain/access/roles"
import { getLocationTypeLabel } from "@/domain/locations/location-type"
import type { LocationSpace } from "@/types/location"
import { LocationTasksWorkspace } from "./LocationTasksWorkspace"
import { LocationSpacesTab } from "./LocationSpacesTab"
import { LocationDetailAttributes } from "./LocationDetailAttributes"
import { LocationDetailOverview } from "./LocationDetailOverview"

interface LocationDetailDialogProps {
    location: Location | null
    onClose: () => void
    clientName: string
    activeLabel: string
    inactiveLabel: string
    onEdit: () => void
}

const sectionClass = "glass-panel rounded-2xl p-3.5"
const mapButtonClass = "glass-panel inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] transition-colors hover:border-accent/35 hover:text-accent"

export function LocationDetailDialog({
    location,
    onClose,
    clientName,
    activeLabel,
    inactiveLabel,
    onEdit,
}: LocationDetailDialogProps) {
    const { dict } = useDictionary()
    const { user } = useUser()
    const [spaces, setSpaces] = useState<LocationSpace[]>([])
    const [spacesLoading, setSpacesLoading] = useState(true)
    const locationId = location?.id

    useEffect(() => {
        if (!locationId) return
        let cancelled = false
        void LocationService.getSpaces(locationId)
            .then((items) => { if (!cancelled) setSpaces(items) })
            .catch(() => { if (!cancelled) setSpaces([]) })
            .finally(() => { if (!cancelled) setSpacesLoading(false) })
        return () => { cancelled = true }
    }, [locationId])

    if (!location) return null

    const taskTemplateCount = spaces.reduce((count, space) => count + (space.tasks?.length || 0), 0)
    const locationTypeLabel = getLocationTypeLabel(location.location_type, {
        private: dict.locations?.type_private,
        real_estate: dict.locations?.type_real_estate,
        business: dict.locations?.type_business,
        exterior: dict.locations?.type_exterior,
        other: dict.locations?.type_other,
    })
    const siteTypeLabel = location.profile?.site_type?.replaceAll("_", " ") ?? null
    const locationOwnerCompanyId = location.owner_company_id ?? location.managing_company_id
    const canManageSpaces = Boolean(user && (isSuperadmin(user) || locationOwnerCompanyId === user.company_id))

    return (
        <Dialog open={location !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                overlayClassName="dialog-glass-overlay"
                className="dialog-glass flex max-h-[min(92vh,920px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[28px] border border-[var(--border-soft)] !border-t border-t-[var(--border-soft)] p-0 text-[var(--text-main)] shadow-[0_28px_90px_var(--shadow-color)] sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1400px]"
            >
                <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:none] sm:p-6 [&::-webkit-scrollbar]:hidden">
                    <DialogHeader className="text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge variant={location.is_active ? "default" : "secondary"} className={location.is_active ? "border-0 bg-accent text-xs font-semibold uppercase tracking-wide text-white" : "text-xs font-semibold uppercase tracking-wide"}>{location.is_active ? activeLabel : inactiveLabel}</Badge>
                                    <Badge variant="secondary" className="text-xs font-medium">{locationTypeLabel}</Badge>
                                </div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">{location.name}</DialogTitle>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><Building2 className="h-3.5 w-3.5 shrink-0" /><span>{clientName}</span></div>
                            </div>
                        </div>
                    </DialogHeader>

                    <section className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:grid-cols-4">
                        <SummaryMetric label="Código" value={location.profile?.internal_code || `LOC-${location.id}`} />
                        <SummaryMetric label="Espacios" value={spacesLoading ? "…" : spaces.length} icon={<Layers3 className="h-4 w-4 text-accent" />} />
                        <SummaryMetric label="Tareas" value={spacesLoading ? "…" : taskTemplateCount} icon={<ListChecks className="h-4 w-4 text-accent" />} />
                        <SummaryMetric label="Acceso" value={location.access?.access_method || (location.access?.has_access_code ? "Código" : "Sin configurar")} />
                    </section>

                    <div className="mt-3 flex justify-end"><Button type="button" size="sm" className="border-accent bg-accent text-white hover:bg-accent/90" onClick={onEdit}><PencilLine className="h-3.5 w-3.5" />Editar ubicación</Button></div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                        <LocationDetailOverview location={location} siteTypeLabel={siteTypeLabel} sectionClass={sectionClass} mapButtonClass={mapButtonClass} />
                        <LocationDetailAttributes location={location} sectionClass={sectionClass} />
                    </div>

                    <section className={`${sectionClass} mt-5`}>
                        <div className="mb-4"><h4 className="text-sm font-bold text-[var(--text-main)]">Estructura de espacios</h4><p className="mt-1 text-xs text-[var(--text-muted)]">Organiza las zonas de trabajo y sus tareas sugeridas sin entrar en los servicios habituales.</p></div>
                        <LocationSpacesTab locationId={location.id} open={location !== null} canManage={canManageSpaces} />
                    </section>

                    <section className={`${sectionClass} mt-5`}>
                        <div className="mb-4"><h4 className="text-sm font-bold text-[var(--text-main)]">Operativa de la ubicación</h4><p className="mt-1 text-xs text-[var(--text-muted)]">Servicios habituales, estructura de espacios y registro de trabajos en un mismo lugar.</p></div>
                        <LocationTasksWorkspace location={location} open={location !== null} initialTab="history" showSpaces={false} />
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SummaryMetric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
    return <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p><p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-main)]">{icon}{value}</p></div>
}
