export const LOCATION_ZONE_TYPE_OPTIONS = [
    "bathroom",
    "office",
    "kitchen",
    "common_area",
    "exterior",
    "other",
] as const;

const LOCATION_ZONE_TYPE_LABELS: Record<string, string> = {
    bathroom: "Baño",
    office: "Despacho",
    kitchen: "Cocina",
    common_area: "Zona común",
    exterior: "Exterior",
    other: "Otra zona",
};

export function getLocationZoneTypeLabel(zoneType: string) {
    return LOCATION_ZONE_TYPE_LABELS[zoneType] || LOCATION_ZONE_TYPE_LABELS.other;
}
