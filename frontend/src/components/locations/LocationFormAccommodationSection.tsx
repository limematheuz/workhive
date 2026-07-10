import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDictionary } from "@/lib/dictionary-context"

interface LocationFormAccommodationSectionProps {
    idPrefix?: string
    sectionKey?: string | number
    numBathroomsDefault?: number
    hasKitchenDefault?: boolean
    hasGarageDefault?: boolean
    hasTerraceDefault?: boolean
}

export function LocationFormAccommodationSection({
    idPrefix = "",
    sectionKey,
    numBathroomsDefault = 1,
    hasKitchenDefault = true,
    hasGarageDefault = true,
    hasTerraceDefault = true,
}: LocationFormAccommodationSectionProps) {
    const { dict } = useDictionary()

    return (
        <div
            className="p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] space-y-4"
            key={sectionKey}
        >
            <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                {dict.locations.form.accommodation_details}
            </h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}num_bathrooms`} className="text-[var(--text-main)]">
                        {dict.locations.form.bathrooms_label}
                    </Label>
                    <Input
                        id={`${idPrefix}num_bathrooms`}
                        name="num_bathrooms"
                        type="number"
                        min="0"
                        defaultValue={numBathroomsDefault}
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)]"
                    />
                </div>
                <div className="flex flex-col justify-end space-y-3 pb-1">
                    <label className="flex items-center gap-3.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer">
                        <input
                            type="checkbox"
                            name="has_kitchen"
                            defaultChecked={hasKitchenDefault}
                            className="rounded border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-accent focus:ring-accent/30"
                        />
                        {dict.locations.form.kitchen_label}
                    </label>
                    <label className="flex items-center gap-3.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer">
                        <input
                            type="checkbox"
                            name="has_garage"
                            defaultChecked={hasGarageDefault}
                            className="rounded border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-accent focus:ring-accent/30"
                        />
                        {dict.locations.form.garage_label}
                    </label>
                    <label className="flex items-center gap-3.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer">
                        <input
                            type="checkbox"
                            name="has_terrace"
                            defaultChecked={hasTerraceDefault}
                            className="rounded border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-accent focus:ring-accent/30"
                        />
                        {dict.locations.form.terrace_label}
                    </label>
                </div>
            </div>
        </div>
    )
}
