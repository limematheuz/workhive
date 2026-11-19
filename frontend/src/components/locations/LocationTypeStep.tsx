import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocationTypeStepProps } from "./location-workspace-types";
import { getLocationTypeVisual } from "./location-visuals";

const compactNames: Record<string, string> = {
    tourist_apartment: "Apartamento", apartment: "Apartamento", residential_community: "Comunidad", community: "Comunidad",
    private_home: "Vivienda", house: "Casa / chalet", chalet: "Casa / chalet", commercial: "Comercio", commercial_premises: "Comercio",
    healthcare: "Clínica", clinic: "Clínica", dental_clinic: "Clínica dental", public_building: "Edificio público", construction: "Obra / reforma",
};

export function LocationTypeStep({ catalog, loading, profile, setProfile }: LocationTypeStepProps) {
    const selectedType = catalog?.site_types.find(type => type.id === profile.site_type);
    return <div className="wh-location-type-step">
        <div><h3 className="text-base font-semibold text-[var(--text-main)]">2. Tipo de ubicación</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Elige el lugar para adaptar sus espacios y tareas.</p></div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-[var(--text-muted)]">Cargando tipos de ubicación…</p> : <div className="wh-location-type-grid">{(catalog?.site_types || []).map(siteType => {
            const selected = siteType.id === profile.site_type;
            const visual = getLocationTypeVisual(siteType.id);
            const Icon = visual.icon;
            return <Button key={siteType.id} type="button" variant="outline" aria-pressed={selected} aria-label={siteType.label} title={siteType.label} onClick={() => setProfile({ ...profile, site_type: siteType.id, attributes: {} })} className="wh-location-type-card">
                <span className={`wh-location-type-icon ${visual.className}`}><Icon className="size-4" aria-hidden="true" /></span>
                <span className="wh-location-type-name"><span className="hidden sm:inline">{siteType.label}</span><span className="sm:hidden">{compactNames[siteType.id] || siteType.label}</span></span>
                {selected && <CheckCircle2 className="wh-location-type-check" aria-hidden="true" />}
            </Button>;
        })}</div>}
        {selectedType && <details className="wh-location-type-help"><summary>Sobre {selectedType.label.toLocaleLowerCase()}</summary><p>{selectedType.description}</p>{selectedType.guidance && selectedType.guidance !== selectedType.description && <p>{selectedType.guidance}</p>}</details>}
    </div>;
}
