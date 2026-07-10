import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDictionary } from "@/lib/dictionary-context"

interface LocationFormMapCoordinatesSectionProps {
    idPrefix?: string
    mapUrlDefault?: string
    latitudeDefault?: number | string
    longitudeDefault?: number | string
}

export function LocationFormMapCoordinatesSection({
    idPrefix = "",
    mapUrlDefault,
    latitudeDefault,
    longitudeDefault,
}: LocationFormMapCoordinatesSectionProps) {
    const { dict } = useDictionary()

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}map_url`} className="text-[var(--text-main)]">
                    {dict.locations.form.map_url_label}
                </Label>
                <Input
                    id={`${idPrefix}map_url`}
                    name="map_url"
                    defaultValue={mapUrlDefault}
                    placeholder={dict.locations.form.map_url_placeholder}
                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}latitude`} className="text-[var(--text-main)]">
                        {dict.locations.form.latitude_label}
                    </Label>
                    <Input
                        id={`${idPrefix}latitude`}
                        name="latitude"
                        type="number"
                        step="any"
                        defaultValue={latitudeDefault}
                        placeholder={dict.locations.form.latitude_placeholder}
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}longitude`} className="text-[var(--text-main)]">
                        {dict.locations.form.longitude_label}
                    </Label>
                    <Input
                        id={`${idPrefix}longitude`}
                        name="longitude"
                        type="number"
                        step="any"
                        defaultValue={longitudeDefault}
                        placeholder={dict.locations.form.longitude_placeholder}
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>
            </div>
        </>
    )
}
