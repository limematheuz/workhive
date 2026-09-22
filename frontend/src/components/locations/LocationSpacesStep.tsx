import { Clock3, ListChecks, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LocationSpacesStepProps } from "./location-workspace-types";

export function LocationSpacesStep({
    editingExistingLocation,
    profile,
    spaces,
    spaceName,
    spaceType,
    suggesting,
    setSpaceName,
    setSpaceType,
    removeSpace,
    addSpace,
    suggestSpaces,
}: LocationSpacesStepProps) {
    return (
        <div className="space-y-6">
            <div><h3 className="text-lg font-bold text-[var(--text-main)]">4. Espacios y tareas</h3><p className="mt-1 text-sm text-[var(--text-muted)]">Acepta las sugerencias útiles o crea solo los espacios que necesitas. No se generan trabajos automáticamente.</p></div>
            {!editingExistingLocation ? <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><ListChecks className="h-4 w-4 text-accent" /> Espacios de trabajo</div><p className="mt-1 text-xs text-[var(--text-muted)]">Las tareas sugeridas quedan como plantillas editables para cada espacio.</p></div><Button type="button" variant="secondary" size="sm" data-dirty-control onClick={suggestSpaces} disabled={suggesting || profile.site_type === "other"}><Sparkles className="h-3.5 w-3.5" /> {suggesting ? "Sugiriendo..." : "Sugerir espacios"}</Button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{spaces.map((space, index) => <div key={space.name.trim().toLocaleLowerCase()} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><ListChecks className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{space.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]"><Clock3 className="h-3 w-3" /> {space.tasks?.length || 0} tareas sugeridas</p></div><Button type="button" aria-label={`Quitar ${space.name}`} variant="ghost" size="icon-xs" data-dirty-control onClick={() => removeSpace(index)} className="text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600"><X className="h-4 w-4" /></Button></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-[1fr_11rem_auto]"><Input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSpace(); } }} placeholder="Ej.: Baño 1" maxLength={100} /><Select value={spaceType} onValueChange={setSpaceType}><SelectTrigger aria-label="Tipo de espacio"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="other">Otro</SelectItem><SelectItem value="bathroom">Baño</SelectItem><SelectItem value="office">Despacho</SelectItem><SelectItem value="kitchen">Cocina</SelectItem><SelectItem value="common_area">Zona común</SelectItem></SelectContent></Select><Button type="button" variant="secondary" data-dirty-control onClick={addSpace} disabled={!spaceName.trim()}><Plus className="h-3.5 w-3.5" /> Añadir espacio</Button></div></section> : <div className="rounded-2xl border border-dashed border-accent/35 bg-accent/[0.04] px-4 py-5 text-sm text-[var(--text-muted)]"><p className="font-semibold text-[var(--text-main)]">Gestiona los espacios después de guardar</p><p className="mt-1">Así evitamos eliminar o sustituir accidentalmente la estructura que ya usa el equipo.</p></div>}
        </div>
    );
}
