import { Bath, Bed, Car, ChefHat, Sun, Users } from "lucide-react"
import { Location } from "@/services/location.service"

interface LocationDetailAttributesProps {
    location: Location
    sectionClass: string
}

export function LocationDetailAttributes({ location, sectionClass }: LocationDetailAttributesProps) {
    return (
        <div className="space-y-3.5">
            <div className={sectionClass}>
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Características e instalaciones</h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold text-[var(--text-main)]">
                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2"><Bath className="h-4 w-4 shrink-0 text-accent" /><span>{location.num_bathrooms || 0} Baño(s)</span></div>
                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2"><ChefHat className="h-4 w-4 shrink-0 text-accent" /><span>{location.has_kitchen ? "Con cocina" : "Sin cocina"}</span></div>
                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2"><Car className="h-4 w-4 shrink-0 text-accent" /><span>{location.has_garage ? "Con garaje" : "Sin garaje"}</span></div>
                    <div className="glass-panel flex items-center gap-2 rounded-xl px-2.5 py-2"><Sun className="h-4 w-4 shrink-0 text-accent" /><span>{location.has_terrace ? "Con terraza" : "Sin terraza"}</span></div>
                </div>
            </div>

            <div className={`${sectionClass} space-y-3`}>
                <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Distribución de dormitorios</h4>
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent"><Users className="h-3 w-3" /><span>Cap. {location.max_capacity || 0} pers.</span></div>
                </div>

                {(!location.rooms || location.rooms.length === 0) ? (
                    <p className="pl-1 text-[11px] italic text-[var(--text-muted)]">No hay habitaciones configuradas.</p>
                ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {location.rooms.map((room) => {
                            const capacity = room.double_beds * 2 + room.single_beds + room.bunk_beds * 2
                            return (
                                <div key={`${room.name}-${room.double_beds}-${room.single_beds}-${room.bunk_beds}`} className="glass-panel flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs">
                                    <div className="flex min-w-0 items-center gap-2"><Bed className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /><span className="truncate font-bold text-[var(--text-main)]">{room.name}</span></div>
                                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                                        {room.double_beds > 0 && <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">{room.double_beds} Matr.</span>}
                                        {room.single_beds > 0 && <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">{room.single_beds} Indiv.</span>}
                                        {room.bunk_beds > 0 && <span className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-1.5 py-0.5">{room.bunk_beds} Lit.</span>}
                                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-black text-accent">Cap: {capacity}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
