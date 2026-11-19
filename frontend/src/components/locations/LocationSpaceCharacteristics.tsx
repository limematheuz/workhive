import { Armchair, Bath, BedDouble, Building2, Check, Coffee, DoorOpen, Grid2X2, Minus, Plus, UsersRound, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spaceFeatureKey } from "@/domain/locations/location-task-catalog";
import type { LocationProfile, LocationSpaceTemplate } from "@/types/location";

const icons = { work_area: Building2, hotel_room: BedDouble, office: Armchair, meeting_room: UsersRound, bathroom: Bath, kitchen: Utensils, office_kitchen: Coffee, reception: Building2, corridor: DoorOpen, bedroom: BedDouble };

type Props = {
    templates: LocationSpaceTemplate[];
    counts: Record<string, number>;
    attributes: LocationProfile["attributes"];
    floorName: string;
    onCountChange: (key: string, value: number) => void;
    onFeatureChange: (key: string, value: boolean) => void;
};

export function LocationSpaceCharacteristics({ templates, counts, attributes, floorName, onCountChange, onFeatureChange }: Props) {
    return <div className="wh-characteristic-grid">
        {templates.map(template => {
            const count = counts[template.count_key] || 0;
            const selected = count > 0;
            const Icon = icons[template.space_type as keyof typeof icons] || Grid2X2;
            return <section key={template.id} className="wh-characteristic-card" data-selected={selected}>
                <Button type="button" variant="ghost" aria-pressed={selected} aria-label={`Incluir ${template.label}`} onClick={() => onCountChange(template.count_key, selected ? 0 : 1)} className="wh-characteristic-choice">
                    <span className="wh-characteristic-icon"><Icon className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{template.label}</span><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">{template.tasks.length} tareas comunes</span></span>
                    <span className="wh-characteristic-check" aria-hidden="true">{selected && <Check className="size-3.5" />}</span>
                </Button>
                <div className="wh-characteristic-quantity">
                    <span className="text-xs text-[var(--text-muted)]">{selected ? "Cantidad" : "No incluido"}</span>
                    <div className="flex items-center" role="group" aria-label={`Cantidad de ${template.name}`}>
                        <Button type="button" variant="outline" size="icon-sm" className="rounded-r-none" aria-label={`Reducir ${template.name}`} disabled={count === 0} onClick={() => onCountChange(template.count_key, count - 1)}><Minus className="size-4" /></Button>
                        <Input type="number" min={0} max={100} inputMode="numeric" value={count} aria-label={`Cantidad de ${template.name} en ${floorName}`} onChange={event => onCountChange(template.count_key, Number(event.target.value))} className="h-9 w-14 rounded-none border-x-0 px-1 text-center text-sm font-semibold tabular-nums" />
                        <Button type="button" variant="outline" size="icon-sm" className="rounded-l-none" aria-label={`Aumentar ${template.name}`} disabled={count >= 100} onClick={() => onCountChange(template.count_key, count + 1)}><Plus className="size-4" /></Button>
                    </div>
                </div>
                {selected && template.features.length > 0 && <div className="wh-characteristic-options">
                    {template.features.map(feature => {
                        const key = spaceFeatureKey(template.id, feature.id);
                        const enabled = attributes[key] === true;
                        return <div key={feature.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-3"><span className="text-xs leading-relaxed">{feature.label}</span><div role="group" aria-label={feature.label} className="inline-flex shrink-0 rounded-lg border border-[var(--border-soft)] p-0.5">
                                <Button type="button" variant="ghost" size="xs" aria-pressed={!enabled} onClick={() => onFeatureChange(key, false)} className={!enabled ? "bg-[var(--bg-tertiary)]" : ""}>No</Button>
                                <Button type="button" variant="ghost" size="xs" aria-pressed={enabled} onClick={() => onFeatureChange(key, true)} className={enabled ? "bg-[var(--brand-blue-soft)] text-accent" : ""}>Sí</Button>
                            </div></div>
                            {enabled && <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{feature.tasks.join(" ")}</p>}
                        </div>;
                    })}
                </div>}
            </section>;
        })}
    </div>;
}
