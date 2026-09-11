import { CalendarDays, Clock3, KeyRound, MapPin, Navigation, TriangleAlert, Users } from "lucide-react"
import { Location } from "@/services/location.service"
import { isSafeLocationMapUrl } from "@/lib/location-map-url"

interface LocationDetailOverviewProps {
    location: Location
    siteTypeLabel: string | null
    sectionClass: string
    mapButtonClass: string
}

const WEEKDAY_LABELS = {
    mon: "Lun",
    tue: "Mar",
    wed: "Mié",
    thu: "Jue",
    fri: "Vie",
    sat: "Sáb",
    sun: "Dom",
} as const

function getGoogleMapsUrl(location: Location) {
    if (isSafeLocationMapUrl(location.map_url)) return location.map_url
    if (location.latitude && location.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
    }
    const query = `${location.address}, ${location.postal_code ? `${location.postal_code} ` : ""}${location.city}`
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function getWazeUrl(location: Location) {
    if (isSafeLocationMapUrl(location.map_url) && location.map_url.includes("waze")) return location.map_url
    if (location.latitude && location.longitude) {
        return `https://waze.com/ul?ll=${location.latitude},${location.longitude}&navigate=yes`
    }
    const query = `${location.address}, ${location.postal_code ? `${location.postal_code} ` : ""}${location.city}`
    return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}

export function LocationDetailOverview({ location, siteTypeLabel, sectionClass, mapButtonClass }: LocationDetailOverviewProps) {
    const activeContacts = location.contacts?.filter((contact) => contact.is_active) ?? []
    const primaryContact = activeContacts.find((contact) => contact.is_primary) ?? activeContacts[0]
    const openRisks = location.risks?.filter((risk) => risk.status === "open") ?? []
    const activeServiceWindows = location.service_windows?.filter((serviceWindow) => serviceWindow.is_active) ?? []
    const nextServiceWindow = activeServiceWindows[0]

    return (
        <div className="space-y-3.5">
            <div className={sectionClass}>
                <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Dirección</p>
                        <p className="text-sm font-semibold leading-relaxed text-[var(--text-main)]">
                            {location.address},{" "}{location.postal_code ? `${location.postal_code} ` : ""}{location.city}
                        </p>
                    </div>
                </div>
            </div>

            {location.latitude && location.longitude && (
                <div className={sectionClass}>
                    <div className="flex items-start gap-2.5">
                        <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Coordenadas</p>
                            <p className="font-mono text-xs font-semibold text-[var(--text-main)]">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                        </div>
                    </div>
                </div>
            )}

            {(location.profile || location.access) && (
                <div className={sectionClass}>
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Información operativa</h4>
                    <div className="space-y-2 text-xs">
                        {location.profile && <div className="flex items-start justify-between gap-3"><span className="text-[var(--text-muted)]">Tipo</span><span className="text-right font-semibold capitalize text-[var(--text-main)]">{siteTypeLabel}</span></div>}
                        {location.profile?.internal_code && <div className="flex items-start justify-between gap-3"><span className="text-[var(--text-muted)]">Código interno</span><span className="text-right font-semibold text-[var(--text-main)]">{location.profile.internal_code}</span></div>}
                        {location.access && <div className="flex items-start gap-2 pt-1 text-[var(--text-main)]"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span>{location.access.permitted_days.length ? `${location.access.permitted_from || "--:--"} – ${location.access.permitted_until || "--:--"}` : "Horario de acceso sin configurar"}</span></div>}
                        {location.access?.instructions && <div className="flex items-start gap-2 pt-1 text-[var(--text-main)]"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span>{location.access.instructions}</span></div>}
                    </div>
                </div>
            )}

            <div className={sectionClass}>
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Operación y planificación</h4>
                <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-2 text-[var(--text-main)]"><Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span>{primaryContact ? `${primaryContact.full_name}${activeContacts.length > 1 ? ` y ${activeContacts.length - 1} más` : ""}` : "Sin contactos operativos"}</span></div>
                    <div className="flex items-start gap-2 text-[var(--text-main)]"><TriangleAlert className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${openRisks.length ? "text-amber-500" : "text-[var(--text-muted)]"}`} /><span>{openRisks.length ? `${openRisks.length} ${openRisks.length === 1 ? "riesgo pendiente" : "riesgos pendientes"}` : "Sin riesgos pendientes"}</span></div>
                    <div className="flex items-start gap-2 text-[var(--text-main)]"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /><span>{nextServiceWindow ? `${nextServiceWindow.days.map((day) => WEEKDAY_LABELS[day]).join(", ")} · ${nextServiceWindow.starts_at}–${nextServiceWindow.ends_at}${activeServiceWindows.length > 1 ? ` · +${activeServiceWindows.length - 1}` : ""}` : "Sin horarios de servicio"}</span></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
                <a href={getGoogleMapsUrl(location)} target="_blank" rel="noopener noreferrer" className={mapButtonClass}>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .007c-6.628 0-12 5.372-12 12s5.372 12 12 12 12-5.372 12-12-5.372-12-12-12zm-3 17.5v-11l7.5 5.5-7.5 5.5z" /></svg>
                    Google Maps
                </a>
                <a href={getWazeUrl(location)} target="_blank" rel="noopener noreferrer" className={mapButtonClass}>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.98 12.39c-.19-1.28-1.04-2.31-2.22-2.73V7.91c0-1.88-1.53-3.41-3.41-3.41s-3.41 1.53-3.41 3.41v1.75c-1.18.42-2.03 1.45-2.22 2.73H7.07c.18-1.92 1.51-3.49 3.32-4.04V7.91c0-2.65 2.15-4.8 4.8-4.8s4.8 2.15 4.8 4.8v.44c1.81.55 3.14 2.12 3.32 4.04H19.98z" /></svg>
                    Waze
                </a>
            </div>
        </div>
    )
}
