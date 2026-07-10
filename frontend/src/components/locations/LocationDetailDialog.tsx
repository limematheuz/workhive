"use client"

import Image from "next/image"
import { Location } from "@/services/location.service"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { MapPin, Building2, Navigation, Compass, Bath, Car, ChefHat, Sun, Bed, Users } from "lucide-react"
import { useDictionary } from "@/lib/dictionary-context"
import { resolveApiMediaUrl } from "@/lib/api"
import { getLocationTypeLabel } from "@/domain/locations/location-type"

const getGoogleMapsUrl = (loc: Location) => {
    if (loc.map_url) {
        return loc.map_url
    }
    if (loc.latitude && loc.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`
    }
    const queryStr = `${loc.address}, ${loc.postal_code ? loc.postal_code + " " : ""}${loc.city}`
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`
}

const getWazeUrl = (loc: Location) => {
    if (loc.map_url && loc.map_url.includes("waze")) {
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
}

export function LocationDetailDialog({
    location,
    onClose,
    clientName,
    activeLabel,
    inactiveLabel,
    gradient,
}: LocationDetailDialogProps) {
    const { dict } = useDictionary()
    if (!location) return null
    const locationTypeLabel = getLocationTypeLabel(location.location_type, {
        private: dict.locations?.type_private,
        real_estate: dict.locations?.type_real_estate,
        business: dict.locations?.type_business,
        exterior: dict.locations?.type_exterior,
        other: dict.locations?.type_other,
    })

    return (
        <Dialog open={location !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="text-[var(--text-main)] p-0 overflow-hidden sm:max-w-3xl lg:max-w-4xl w-full max-h-[92vh]">
                {/* Header banner: image or gradient */}
                {location.photo_url ? (
                    <div className="h-40 sm:h-48 w-full relative">
                        <Image
                            src={resolveApiMediaUrl(location.photo_url) || ""}
                            alt={location.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 64rem"
                            className="object-cover"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-6 flex gap-1.5">
                            <Badge
                                variant={location.is_active ? "default" : "secondary"}
                                className={
                                    location.is_active
                                        ? "bg-emerald-500/90 text-white border-0 shadow-sm text-xs"
                                        : "bg-black/40 text-white/80 border-0 shadow-sm text-xs backdrop-blur-sm"
                                }
                            >
                                {location.is_active ? activeLabel : inactiveLabel}
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="bg-black/40 text-white/95 border-0 shadow-sm text-xs backdrop-blur-sm"
                            >
                                {locationTypeLabel}
                            </Badge>
                        </div>
                    </div>
                ) : (
                    <div className="h-40 sm:h-48 w-full relative" style={{ background: gradient }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Compass className="w-16 h-16 text-white/40" />
                        </div>
                        <div className="absolute bottom-4 left-6 flex gap-1.5">
                            <Badge
                                variant={location.is_active ? "default" : "secondary"}
                                className={
                                    location.is_active
                                        ? "bg-emerald-500/90 text-white border-0 shadow-sm text-xs"
                                        : "bg-black/40 text-white/80 border-0 shadow-sm text-xs backdrop-blur-sm"
                                }
                            >
                                {location.is_active ? activeLabel : inactiveLabel}
                            </Badge>
                            <Badge
                                variant="secondary"
                                className="bg-black/40 text-white/95 border-0 shadow-sm text-xs backdrop-blur-sm"
                            >
                                {locationTypeLabel}
                            </Badge>
                        </div>
                    </div>
                )}

                <div className="max-h-[calc(92vh-10rem)] overflow-y-auto p-5 sm:p-6">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black text-[var(--text-main)] mb-1">
                            {location.name}
                        </DialogTitle>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{clientName}</span>
                        </div>
                    </DialogHeader>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="space-y-4">
                            {/* Address */}
                            <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)]">
                                <div className="flex items-start gap-2.5">
                                    <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-2xs font-black uppercase text-[var(--text-muted)] mb-0.5">Dirección</p>
                                        <p className="text-xs text-[var(--text-main)] leading-relaxed font-semibold">
                                            {location.address}, {location.postal_code ? location.postal_code + " " : ""}{location.city}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Coordinates */}
                            {location.latitude && location.longitude && (
                                <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)]">
                                    <div className="flex items-start gap-2.5">
                                        <Navigation className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-2xs font-black uppercase text-[var(--text-muted)] mb-0.5">Coordenadas</p>
                                            <p className="text-xs font-mono text-[var(--text-main)] font-semibold">
                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Map links */}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                <a
                                    href={getGoogleMapsUrl(location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-main)] transition-colors cursor-pointer"
                                >
                                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 .007c-6.628 0-12 5.372-12 12s5.372 12 12 12 12-5.372 12-12-5.372-12-12-12zm-3 17.5v-11l7.5 5.5-7.5 5.5z" />
                                    </svg>
                                    Google Maps
                                </a>
                                <a
                                    href={getWazeUrl(location)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-main)] transition-colors cursor-pointer"
                                >
                                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.98 12.39c-.19-1.28-1.04-2.31-2.22-2.73V7.91c0-1.88-1.53-3.41-3.41-3.41s-3.41 1.53-3.41 3.41v1.75c-1.18.42-2.03 1.45-2.22 2.73H7.07c.18-1.92 1.51-3.49 3.32-4.04V7.91c0-2.65 2.15-4.8 4.8-4.8s4.8 2.15 4.8 4.8v.44c1.81.55 3.14 2.12 3.32 4.04H19.98z" />
                                    </svg>
                                    Waze
                                </a>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Features and amenities */}
                            <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)]">
                                <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">
                                    Características e Instalaciones
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-[var(--text-main)]">
                                    <div className="flex items-center gap-2">
                                        <Bath className="w-4 h-4 text-accent shrink-0" />
                                        <span>{location.num_bathrooms || 0} Baño(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ChefHat className="w-4 h-4 text-accent shrink-0" />
                                        <span>{location.has_kitchen ? "Con Cocina" : "Sin Cocina"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Car className="w-4 h-4 text-accent shrink-0" />
                                        <span>{location.has_garage ? "Con Garaje" : "Sin Garaje"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Sun className="w-4 h-4 text-accent shrink-0" />
                                        <span>{location.has_terrace ? "Con Terraza" : "Sin Terraza"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bedrooms and capacity */}
                            <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-2 mb-1">
                                    <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        Distribución de Dormitorios
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-accent bg-accent/10 px-2.5 py-0.5 rounded-lg text-3xs font-black uppercase tracking-wider">
                                        <Users className="w-3 h-3" />
                                        <span>Cap. {location.max_capacity || 0} pers.</span>
                                    </div>
                                </div>

                                {(!location.rooms || location.rooms.length === 0) ? (
                                    <p className="text-2xs text-[var(--text-muted)] italic pl-1">No hay habitaciones configuradas.</p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {location.rooms.map((room) => {
                                            const rCap = room.double_beds * 2 + room.single_beds * 1 + room.bunk_beds * 2;
                                            return (
                                                <div key={`${room.name}-${room.double_beds}-${room.single_beds}-${room.bunk_beds}`} className="flex items-center justify-between p-2.5 bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-lg text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Bed className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                                        <span className="font-bold text-[var(--text-main)] truncate">{room.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 text-3xs text-[var(--text-muted)] font-medium">
                                                        {room.double_beds > 0 && <span className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1 rounded">{room.double_beds} Matr.</span>}
                                                        {room.single_beds > 0 && <span className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1 rounded">{room.single_beds} Indiv.</span>}
                                                        {room.bunk_beds > 0 && <span className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1 rounded">{room.bunk_beds} Lit.</span>}
                                                        <span className="bg-accent/15 text-accent font-black px-1.5 py-0.5 rounded-md">
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
