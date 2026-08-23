import { CheckCircle2 } from "lucide-react";

import type { LocationTypeStepProps } from "./location-workspace-types";
import { getLocationTypeVisual } from "./location-visuals";

export function LocationTypeStep({ catalog, loading, profile, setProfile }: LocationTypeStepProps) {
    return (
        <>
            <div><h3 className="text-lg font-bold text-[var(--text-main)]">2. Tipo de ubicación</h3><p className="mt-1 text-sm text-[var(--text-muted)]">Elige el tipo de lugar para adaptar las preguntas, los espacios y las tareas sugeridas.</p></div>
            {loading ? <p className="py-12 text-center text-sm text-[var(--text-muted)]">Cargando tipos de ubicación...</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(catalog?.site_types || []).map((siteType) => {
                const selected = siteType.id === profile.site_type;
                const visual = getLocationTypeVisual(siteType.id);
                const Icon = visual.icon;
                return <button key={siteType.id} type="button" onClick={() => setProfile({ ...profile, site_type: siteType.id, attributes: {} })} className={`relative min-h-32 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:shadow-sm ${selected ? "border-accent bg-accent/[0.06] shadow-[0_0_0_1px_var(--accent-color)]" : "border-[var(--border-soft)] bg-[var(--bg-primary)] hover:border-accent/35"}`}><span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${visual.className}`}><Icon className="h-5 w-5" /></span>{selected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-accent" />}<span className="block text-sm font-bold text-[var(--text-main)]">{siteType.label}</span><span className="mt-1.5 block text-xs leading-5 text-[var(--text-muted)]">{siteType.description}</span></button>;
            })}</div>}
        </>
    );
}
