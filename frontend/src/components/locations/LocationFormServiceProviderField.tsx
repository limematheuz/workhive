import { Label } from "@/components/ui/label"
import { useDictionary } from "@/lib/dictionary-context"
import { Company } from "@/types/company"

interface LocationFormServiceProviderFieldProps {
    id: string
    selectedProviderId: string
    onProviderChange: (value: string) => void
    serviceProviders: Company[]
    providersLoading: boolean
    hintClassName?: string
}

export function LocationFormServiceProviderField({
    id,
    selectedProviderId,
    onProviderChange,
    serviceProviders,
    providersLoading,
    hintClassName = "text-xs text-[var(--text-muted)]",
}: LocationFormServiceProviderFieldProps) {
    const { dict } = useDictionary()

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-[var(--text-main)]">
                {dict.locations.form.default_provider_label}
            </Label>
            <select
                id={id}
                name="default_service_provider"
                aria-label={dict.locations.form.default_provider_label}
                value={selectedProviderId}
                onChange={(event) => onProviderChange(event.target.value)}
                disabled={providersLoading}
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2 rounded-md outline-none text-sm cursor-pointer"
            >
                <option value="">
                    {providersLoading
                        ? dict.locations.form.providers_loading
                        : dict.locations.form.default_provider_choose}
                </option>
                {serviceProviders.map((company) => (
                    <option key={company.id} value={company.id}>
                        {company.name}
                    </option>
                ))}
            </select>
            {!providersLoading && serviceProviders.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    {dict.locations.form.providers_empty}
                </p>
            )}
            <p className={hintClassName}>
                {dict.locations.form.default_provider_hint}
            </p>
        </div>
    )
}
