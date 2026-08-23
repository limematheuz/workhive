import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocationFeaturesStepProps } from "./location-workspace-types";

export function LocationFeaturesStep({ profile, catalog, setProfile, setAttribute }: LocationFeaturesStepProps) {
    const siteType = catalog?.site_types.find((item) => item.id === profile.site_type);
    return (
        <>
            <div><h3 className="text-sm font-bold text-[var(--text-main)]">3. Características {siteType ? `— ${siteType.label}` : ""}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Todas estas respuestas son opcionales. Sirven para afinar los espacios y tareas sugeridos.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="location-workspace-code">Código interno</Label><Input id="location-workspace-code" value={profile.internal_code || ""} onChange={(event) => setProfile({ ...profile, internal_code: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="location-workspace-reference">Referencia en el sitio</Label><Input id="location-workspace-reference" value={profile.site_reference || ""} onChange={(event) => setProfile({ ...profile, site_reference: event.target.value })} /></div>
            </div>
            {siteType && <div className="grid gap-3 sm:grid-cols-2">{siteType.attributes.map((attribute) => <label key={attribute.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-main)]"><span>{attribute.label}</span>{attribute.kind === "boolean" ? <input type="checkbox" checked={profile.attributes[attribute.id] === true} onChange={(event) => setAttribute(attribute.id, event.target.checked)} className="h-4 w-4 accent-accent" /> : <Input type="number" min="0" value={typeof profile.attributes[attribute.id] === "number" ? String(profile.attributes[attribute.id]) : ""} onChange={(event) => setAttribute(attribute.id, event.target.value === "" ? "" : Number(event.target.value))} className="h-8 w-24 text-right" />}</label>)}</div>}
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="location-contact-name">Persona de contacto</Label><Input id="location-contact-name" value={profile.contact_name || ""} onChange={(event) => setProfile({ ...profile, contact_name: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="location-contact-phone">Teléfono</Label><Input id="location-contact-phone" value={profile.contact_phone || ""} onChange={(event) => setProfile({ ...profile, contact_phone: event.target.value })} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="location-service-notes">Observaciones</Label><textarea id="location-service-notes" value={profile.service_notes || ""} onChange={(event) => setProfile({ ...profile, service_notes: event.target.value })} className="min-h-20 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-main)]" /></div>
        </>
    );
}
