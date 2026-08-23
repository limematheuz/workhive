"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { Location, LocationService } from "@/services/location.service"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Building2, Navigation, Compass, Bath, Car, ChefHat, Sun, Bed, Users, Clock3, KeyRound, Layers3, ListChecks, PencilLine } from "lucide-react"
import { useDictionary } from "@/lib/dictionary-context"
import { resolveApiMediaUrl } from "@/lib/api"
import { getLocationTypeLabel } from "@/domain/locations/location-type"
import { isSafeLocationMapUrl } from "@/lib/location-map-url"
import type { LocationSpace } from "@/types/location"
import { LocationTasksWorkspace } from "./LocationTasksWorkspace"

const getGoogleMapsUrl = (loc: Location) => {
    if (isSafeLocationMapUrl(loc.map_url)) {
        return loc.map_url
    }
    if (loc.latitude && loc.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`
    }
    const queryStr = `${loc.address}, ${loc.postal_code ? loc.postal_code + " " : ""}${loc.city}`
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`
}

const getWazeUrl = (loc: Location) => {
    if (isSafeLocationMapUrl(loc.map_url) && loc.map_url.includes("waze")) {
        return loc.map_url
    }
    if (loc.latitude && loc.longitude) {
        return `https://waze.com/ul?ll=${loc.latitude},${loc.longitude}&navigate=yes`
    }
    const queryStr = `${loc.address}, ${loc.postal_code ? loc.postal_code + " " : ""}${loc.city}`
    return `https://waze.com/ul?q=${encodeURIComponent(queryStr)}&navigate=yes`
}

interface LocationDetailDialogProps {
    location: Location | null
    onClose: () => void
    clientName: string
    activeLabel: string
    inactiveLabel: string
    gradient: string
    onEdit: () => void
}

const sectionClass = "glass-panel rounded-2xl p-3.5"

const mapBtnClass =
    "glass-panel inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-main)] transition-colors hover:border-accent/35 hover:text-accent"

export function LocationDetailDialog({
    location,
    onClose,
    clientName,
    activeLabel,
    inactiveLabel,
    gradient,
    onEdit,
}: LocationDetailDialogProps) {
    const { dict } = useDictionary()
    const [spaces, setSpaces] = useState<LocationSpace[]>([])
    const [spacesLoading, setSpacesLoading] = useState(true)
    const locationId = location?.id

    useEffect(() => {
        if (!locationId) {
            return
        }
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
    const siteTypeLabel = location.profile?.site_type
        ? location.profile.site_type.replaceAll("_", " ")
        : null

    return (
        <Dialog open={location !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                overlayClassName="dialog-glass-overlay"
                className="dialog-glass flex max-h-[min(92vh,920px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[28px] border border-[var(--border-soft)] !border-t border-t-[var(--border-soft)] p-0 text-[var(--text-main)] shadow-[0_28px_90px_var(--shadow-color)] sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1400px]"
            >
                {location.photo_url ? (
                    <div className="relative h-40 w-full shrink-0 sm:h-52">
                        <Image
                            src={resolveApiMediaUrl(location.photo_url) || ""}
                            alt={location.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 64rem"
                            className="object-cover"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                        <div className="absolute bottom-3.5 left-5 flex flex-wrap gap-1.5 sm:left-6">
                            <Badge
                                variant={location.is_active ? "default" : "secondary"}
                                className={
                                    location.is_active
                                        ? "border-0 bg-accent/90 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
                                        : "border-0 bg-black/40 text-xs font-semibold uppercase tracking-wide text-white/80 shadow-sm backdrop-blur-sm"
                                }
                            >
                                {location.is_active ? activeLabel : inactiveLabel}
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="border-0 bg-black/40 text-xs text-white/95 shadow-sm backdrop-blur-sm"
                            >
                                {locationTypeLabel}
                            </Badge>
                        </div>
                    </div>
                ) : (
                    <div className="relative h-40 w-full shrink-0 sm:h-52" style={{ background: gradient }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
                                <Compass className="h-8 w-8 text-white/90" />
                            </div>
                        </div>
                        <div className="absolute bottom-3.5 left-5 flex flex-wrap gap-1.5 sm:left-6">
                            <Badge
                                variant={location.is_active ? "default" : "secondary"}
                                className={
                                    location.is_active
                                        ? "border-0 bg-accent/90 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
                                        : "border-0 bg-black/40 text-xs font-semibold uppercase tracking-wide text-white/80 shadow-sm backdrop-blur-sm"
                                }
                            >
                                {location.is_active ? activeLabel : inactiveLabel}
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="border-0 bg-black/40 text-xs text-white/95 shadow-sm backdrop-blur-sm"
                            >
                                {locationTypeLabel}
                            </Badge>
                        </div>
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:none] sm:p-6 [&::-webkit-scrollbar]:hidden">
                    <DialogHeader className="text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                                <DialogTitle className="text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                                    {location.name}
                                </DialogTitle>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>{clientName}</span>
                                </div>
                            </div>
                            <Button type="button" size="sm" onClick={onEdit}><PencilLine className="h-3.5 w-3.5" /> Editar ubicación</Button>
                        </div>
                    </DialogHeader>

                    <section className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Código</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{location.profile?.internal_code || `LOC-${location.id}`}</p></div>
                        <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Espacios</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]"><Layers3 className="h-4 w-4 text-accent" /> {spacesLoading ? "…" : spaces.length}</p></div>
                        <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Tareas</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]"><ListChecks className="h-4 w-4 text-accent" /> {spacesLoading ? "…" : taskTemplateCount}</p></div>
                        <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Acceso</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text-main)]">{location.access?.access_method || (location.access?.has_access_code ? "Código" : "Sin configurar")}</p></div>
                    </section>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                        <div className="space-y-3.5">
                            <div className={sectionClass}>
                                <div className="flex items-start gap-2.5">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                    <div className="min-w-0">
                                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                            Dirección
                                        </p>
                                        <p className="text-sm font-semibold leading-relaxed text-[var(--text-main)]">
                                            {location.address},{" "}
                                            {location.postal_code ? `${location.postal_code} ` : ""}
                                            {location.city}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {location.latitude && location.longitude && (
                                <div className={sectionClass}>
                                    <div className="flex items-start gap-2.5">
                                        <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                        <div>
                                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                                Coordenadas
                                            </p>
                                            <p className="font-mono text-xs font-semibold text-[var(--text-main)]">
                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(location.profile || location.access) && (
                                <div className={sectionClass}>
                                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                        Información operativa
                                    </h4>
                                    <div className="space-y-2 text-xs">
                                        {location.profile && (
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-[var(--text-muted)]">Tipo</span>
                                                <span className="text-right font-semibold capitalize text-[var(--text-main)]">{siteTypeLabel}</span>
                                            </div>
                                        )}
                                        {location.profile?.internal_code && (
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-[var(--text-muted)]">Código interno</span>
                                                <span className="text-right font-semibold text-[var(--text-main)]">{location.profile.internal_code}</span>
                                            </div>
                                        )}
                                        {location.access && (
                                            <div className="flex items-start gap-2 pt-1 text-[var(--text-main)]">
                                                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                                                <span>{location.access.permitted_days.length ? `${location.access.permitted_from || "--:--"} – ${location.access.permitted_until || "--:--"}` : "Horario de acceso sin configurar"}</span>
                                            </div>
                                        )}
                                        {location.access?.instructions && (
                                            <div className="flex items-start gap-2 pt-1 text-[var(--text-main)]">
                                                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                                                <span>{location.access.instructions}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                                <a
                                    href={getGoogleMapsUrl(location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={mapBtnClass}
                                >
                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 .007c-6.628 0-12 5.372-12 12s5.372 12 12 12 12-5.372 12-12-5.372-12-12-12zm-3 17.5v-11l7.5 5.5-7.5 5.5z" />
                                    </svg>
                                    Google Maps
                                </a>
                                <a
                                    href={getWazeUrl(location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={mapBtnClass}
                                >
                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.98 12.39c-.19-1.28-1.04-2.31-2.22-2.73V7.91c0-1.88-1.53-3.41-3.41-3.41s-3.41 1.53-3.41 3.41v1.75c-1.18.42-2.03 1.45-2.22 2.73H7.07c.18-1.92 1.51-3.49 3.32-4.04V7.91c0-2.65 2.15-4.8 4.8-4.8s4.8 2.15 4.8 4.8v.44c1.81.55 3.14 2.12 3.32 4.04H19.98z" />
                                    </svg>
                                    Waze
                                </a>
                            </div>
                        </div>

                        <div className="space-y-3.5">
                            <div className={sectionClass}>
                                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    Características e Instalaciones
                                </h4>
                                <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-[var(--text-main)]">
                                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
                                        <Bath className="h-4 w-4 shrink-0 text-accent" />
                                        <span>{location.num_bathrooms || 0} Baño(s)</span>
                                    </div>
                                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
                                        <ChefHat className="h-4 w-4 shrink-0 text-accent" />
                                        <span>{location.has_kitchen ? "Con Cocina" : "Sin Cocina"}</span>
                                    </div>
                                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
                                        <Car className="h-4 w-4 shrink-0 text-accent" />
                                        <span>{location.has_garage ? "Con Garaje" : "Sin Garaje"}</span>
                                    </div>
                                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
                                        <Sun className="h-4 w-4 shrink-0 text-accent" />
                                        <span>{location.has_terrace ? "Con Terraza" : "Sin Terraza"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={`${sectionClass} space-y-3`}>
                                <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                        Distribución de Dormitorios
                                    </h4>
                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent">
                                        <Users className="h-3 w-3" />
                                        <span>Cap. {location.max_capacity || 0} pers.</span>
                                    </div>
                                </div>

                                {(!location.rooms || location.rooms.length === 0) ? (
                                    <p className="pl-1 text-[11px] italic text-[var(--text-muted)]">
                                        No hay habitaciones configuradas.
                                    </p>
                                ) : (
                                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                        {location.rooms.map((room) => {
                                            const rCap =
                                                room.double_beds * 2 +
                                                room.single_beds * 1 +
                                                room.bunk_beds * 2
                                            return (
                                                <div
                                                    key={`${room.name}-${room.double_beds}-${room.single_beds}-${room.bunk_beds}`}
                                                    className="glass-panel flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <Bed className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                                                        <span className="truncate font-bold text-[var(--text-main)]">
                                                            {room.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                                                        {room.double_beds > 0 && (
                                                            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">
                                                                {room.double_beds} Matr.
                                                            </span>
                                                        )}
                                                        {room.single_beds > 0 && (
                                                            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">
                                                                {room.single_beds} Indiv.
                                                            </span>
                                                        )}
                                                        {room.bunk_beds > 0 && (
                                                            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">
                                                                {room.bunk_beds} Lit.
                                                            </span>
                                                        )}
                                                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-black text-accent">
                                                            Cap: {rCap}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <section className={`${sectionClass} mt-5`}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-bold text-[var(--text-main)]">Operativa de la ubicación</h4>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Servicios habituales, estructura de espacios y registro de trabajos en un mismo lugar.</p>
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={onEdit}><PencilLine className="h-3.5 w-3.5" /> Editar</Button>
                        </div>
                        <LocationTasksWorkspace location={location} open={location !== null} initialTab="history" />
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}
