"use client"

import { useCallback, useState } from "react"
import { Building2, PencilLine } from "lucide-react"
import { Location } from "@/services/location.service"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"
import { getLocationTypeLabel } from "@/domain/locations/location-type"
import type { LocationSpace } from "@/types/location"
import { LocationTasksWorkspace } from "./LocationTasksWorkspace"
import { LocationSpacesTab } from "./LocationSpacesTab"
import { LocationDetailAttributes } from "./LocationDetailAttributes"
import { LocationSavedSummary } from "./LocationSavedSummary"
import { LocationDetailOverview } from "./LocationDetailOverview"
import { DocumentRegisterWorkspace } from "@/components/documents/DocumentRegisterWorkspace"
import { RecordHistoryPanel } from "@/components/history/RecordHistoryPanel"

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
    const [spaceSnapshot, setSpaceSnapshot] = useState<{ locationId: number; spaces: LocationSpace[] } | null>(null)
    const [documentsOpen, setDocumentsOpen] = useState(false)
    const locationId = location?.id
    const updateSpaceSummary = useCallback((spaces: LocationSpace[]) => {
        if (locationId) setSpaceSnapshot({ locationId, spaces })
    }, [locationId])
    const spacesLoading = spaceSnapshot?.locationId !== locationId
    const spaces = spaceSnapshot && spaceSnapshot.locationId === locationId ? spaceSnapshot.spaces : []

    if (!location) return null

    const locationTypeLabel = getLocationTypeLabel(location.location_type, {
        private: dict.locations?.type_private,
        real_estate: dict.locations?.type_real_estate,
        business: dict.locations?.type_business,
        exterior: dict.locations?.type_exterior,
        other: dict.locations?.type_other,
    })
    const siteTypeLabel = location.profile?.site_type?.replaceAll("_", " ") ?? null
    const canManageLocation = location.can_manage_location === true

    return (
        <Dialog open={location !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                overlayClassName="dialog-glass-overlay"
                className="wh-location-detail dialog-glass flex max-h-[min(96dvh,1100px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border border-[var(--border-soft)] !border-t border-t-[var(--border-soft)] p-0 text-[var(--text-main)] shadow-[0_28px_90px_var(--shadow-color)] sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1500px]"
            >
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <DialogHeader className="text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge variant={location.is_active ? "default" : "secondary"} className={location.is_active ? "border-0 bg-accent/90 text-xs font-semibold uppercase tracking-wide text-white" : "text-xs font-semibold uppercase tracking-wide"}>{location.is_active ? activeLabel : inactiveLabel}</Badge>
                                    <Badge variant="secondary" className="text-xs font-medium">{locationTypeLabel}</Badge>
                                </div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">{location.name}</DialogTitle>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><Building2 className="h-3.5 w-3.5 shrink-0" /><span>{clientName}</span></div>
                            </div>
                            {canManageLocation && <Button type="button" size="sm" onClick={onEdit}><PencilLine className="h-3.5 w-3.5" />Editar ubicación</Button>}
                        </div>
                    </DialogHeader>

                    <div className="mt-4">{spacesLoading ? <p role="status" className="text-sm text-[var(--text-muted)]">Cargando espacios y tareas…</p> : <LocationSavedSummary location={location} spaces={spaces} clientName={clientName} />}</div>
                    <details className="mt-4 rounded-xl border border-[var(--border-soft)] p-4"><summary className="cursor-pointer text-sm font-semibold">Más datos operativos, mapas e instalaciones</summary>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <LocationDetailOverview location={location} siteTypeLabel={siteTypeLabel} sectionClass={sectionClass} mapButtonClass={mapButtonClass} />
                        <LocationDetailAttributes location={location} sectionClass={sectionClass} />
                    </div>

                    </details>

                    <details className={`${sectionClass} mt-4`}><summary className="cursor-pointer text-sm font-semibold">Gestionar espacios y tareas de la ubicación</summary><div className="mt-4">
                        <LocationSpacesTab locationId={location.id} open={location !== null} canManage={canManageLocation} onSpacesChange={updateSpaceSummary} />
                    </div></details>

                    <section className={`${sectionClass} mt-5`}>
                        <div className="mb-4"><h4 className="text-sm font-bold text-[var(--text-main)]">Operativa de la ubicación</h4><p className="mt-1 text-xs text-[var(--text-muted)]">Servicios habituales, estructura de espacios y registro de trabajos en un mismo lugar.</p></div>
                        <LocationTasksWorkspace location={location} open={location !== null} initialTab="history" showSpaces={false} />
                    </section>
                    <details className={`${sectionClass} mt-4`} onToggle={event => setDocumentsOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Documentación, versiones y firmas</summary><div className="mt-4">{documentsOpen && <DocumentRegisterWorkspace ownerType="location" ownerId={location.id} embedded />}</div></details>
                    <RecordHistoryPanel entityType="location" entityId={location.id} />
                </div>
            </DialogContent>
        </Dialog>
    )
}
