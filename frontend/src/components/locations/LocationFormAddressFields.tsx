import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDictionary } from "@/lib/dictionary-context"

interface LocationFormAddressFieldsProps {
    idPrefix?: string
    addressDefault?: string
    cityDefault?: string
    postalCodeDefault?: string
    showAddressPlaceholder?: boolean
}

export function LocationFormAddressFields({
    idPrefix = "",
    addressDefault,
    cityDefault,
    postalCodeDefault,
    showAddressPlaceholder = true,
}: LocationFormAddressFieldsProps) {
    const { dict } = useDictionary()

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}address`} className="text-[var(--text-main)]">
                    {dict.locations.form.address_label}
                </Label>
                <Input
                    id={`${idPrefix}address`}
                    name="address"
                    defaultValue={addressDefault}
                    placeholder={showAddressPlaceholder ? dict.locations.form.address_placeholder : undefined}
                    required
                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}city`} className="text-[var(--text-main)]">
                        {dict.locations.form.city_label}
                    </Label>
                    <Input
                        id={`${idPrefix}city`}
                        name="city"
                        defaultValue={cityDefault}
                        placeholder={showAddressPlaceholder ? dict.locations.form.city_placeholder : undefined}
                        required
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}postal_code`} className="text-[var(--text-main)]">
                        {dict.locations.form.postal_code_label}
                    </Label>
                    <Input
                        id={`${idPrefix}postal_code`}
                        name="postal_code"
                        defaultValue={postalCodeDefault}
                        placeholder={dict.locations.form.postal_code_placeholder}
                        className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                    />
                </div>
            </div>
        </>
    )
}
