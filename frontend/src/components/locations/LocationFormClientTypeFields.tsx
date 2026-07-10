import { Client } from "@/services/client.service"
import { Label } from "@/components/ui/label"
import { useDictionary } from "@/lib/dictionary-context"
import { LOCATION_TYPE_OPTIONS } from "@/domain/locations/location-type"

interface LocationFormClientTypeFieldsProps {
    clients: Client[]
    idPrefix?: string
    clientSelectKey?: string | number
    clientDefaultValue?: string | number
    locationTypeSelectKey?: string | number
    locationTypeDefaultValue: string
}

export function LocationFormClientTypeFields({
    clients,
    idPrefix = "",
    clientSelectKey,
    clientDefaultValue = "",
    locationTypeSelectKey,
    locationTypeDefaultValue,
}: LocationFormClientTypeFieldsProps) {
    const { dict } = useDictionary()

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}client`} className="text-[var(--text-main)]">
                    {dict.locations.form.client_optional}
                </Label>
                <select
                    id={`${idPrefix}client`}
                    name="client"
                    aria-label={dict.locations.form.client_optional}
                    key={clientSelectKey}
                    defaultValue={clientDefaultValue}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2 rounded-md outline-none text-sm cursor-pointer"
                >
                    <option value="">{dict.locations.form.no_client_associated}</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <p className="text-xs text-[var(--text-muted)]">
                    {dict.locations.form.client_hint}
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}location_type`} className="text-[var(--text-main)]">
                    {dict.locations.form.type_label}
                </Label>
                <select
                    id={`${idPrefix}location_type`}
                    name="location_type"
                    required
                    aria-label={dict.locations.form.type_label}
                    key={locationTypeSelectKey}
                    defaultValue={locationTypeDefaultValue}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2 rounded-md outline-none text-sm cursor-pointer"
                >
                    {LOCATION_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                            {dict.locations.form[`type_${type}` as keyof typeof dict.locations.form]}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
