export const LOCATION_TYPE_OPTIONS = [
    "private",
    "real_estate",
    "business",
    "exterior",
    "other",
] as const;

export function normalizeLocationType(value?: string | null) {
    return value === "particular" || !value ? "private" : value;
}

export function getLocationTypeLabel(
    value: string | null | undefined,
    labels: Record<string, string | undefined>,
) {
    return labels[normalizeLocationType(value)] || labels.other || "";
}
