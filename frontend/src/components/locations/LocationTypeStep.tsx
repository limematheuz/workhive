import type { LocationTypeStepProps } from "./location-workspace-types";

export function LocationTypeStep({ catalog, loading, profile, setProfile }: LocationTypeStepProps) {
    return (
        <>
            <div><h3 className="text-sm font-bold text-[var(--text-main)]">2. Tipo de ubicación</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Elige el tipo para adaptar las preguntas y las sugerencias. También puedes seleccionar “Otro”.</p></div>
            {loading ? <p className="py-8 text-center text-sm text-[var(--text-muted)]">Cargando tipos de ubicación...</p> : <div className="grid gap-2 sm:grid-cols-2">{(catalog?.site_types || []).map((siteType) => {
                const selected = siteType.id === profile.site_type;
                return <button key={siteType.id} type="button" onClick={() => setProfile({ ...profile, site_type: siteType.id, attributes: {} })} className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-accent bg-accent/10" : "border-[var(--border-soft)] bg-[var(--bg-primary)] hover:border-accent/35"}`}><span className="block text-sm font-bold text-[var(--text-main)]">{siteType.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{siteType.description}</span></button>;
            })}</div>}
        </>
    );
}
