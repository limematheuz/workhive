import { Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <>
            <div><h3 className="text-sm font-bold text-[var(--text-main)]">4. Espacios y tareas</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Acepta las sugerencias útiles o crea solo los espacios que necesitas. No se generan trabajos automáticamente.</p></div>
            {!editingExistingLocation ? <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-[var(--text-main)]">Espacios de trabajo</p><p className="text-xs text-[var(--text-muted)]">Las tareas sugeridas quedan como plantillas editables para cada espacio.</p></div><Button type="button" variant="secondary" size="sm" onClick={suggestSpaces} disabled={suggesting || profile.site_type === "other"}><Sparkles className="h-3.5 w-3.5" /> Sugerir espacios</Button></div>
                <div className="space-y-2">{spaces.map((space, index) => <div key={`${space.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{space.name}</p><p className="text-xs text-[var(--text-muted)]">{space.tasks?.length || 0} tareas sugeridas</p></div><button type="button" aria-label={`Quitar ${space.name}`} onClick={() => removeSpace(index)} className="text-[var(--text-muted)] hover:text-red-500"><X className="h-4 w-4" /></button></div>)}</div>
                <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]"><Input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSpace(); } }} placeholder="Ej.: Baño 1" maxLength={100} /><select value={spaceType} onChange={(event) => setSpaceType(event.target.value)} className="h-10 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="other">Otro</option><option value="bathroom">Baño</option><option value="office">Despacho</option><option value="kitchen">Cocina</option><option value="common_area">Zona común</option></select><Button type="button" variant="secondary" onClick={addSpace} disabled={!spaceName.trim()}><Plus className="h-3.5 w-3.5" /> Añadir</Button></div>
            </div> : <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-3 text-sm text-[var(--text-muted)]">Guarda estos datos. Después podrás gestionar los espacios y sus tareas desde la pestaña “Espacios”.</p>}
        </>
    );
}
