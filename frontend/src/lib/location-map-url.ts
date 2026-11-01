const ALLOWED_MAP_HOSTS = new Set([
    "google.com",
    "www.google.com",
    "maps.google.com",
    "maps.app.goo.gl",
    "waze.com",
    "www.waze.com",
])

export function isSafeLocationMapUrl(value?: string | null): value is string {
    if (!value) return false

    try {
        const parsed = new URL(value)
        return parsed.protocol === "https:" && ALLOWED_MAP_HOSTS.has(parsed.hostname)
    } catch {
        return false
    }
}

/** Build navigation only from authorized location data, never a display fallback. */
export function getLocationNavigationHref(location: {
    map_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    city?: string | null;
} | null): string | null {
    if (!location) return null;
    if (isSafeLocationMapUrl(location.map_url)) return location.map_url;
    const { latitude, longitude } = location;
    let query: string;
    if (typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90
        && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180) {
        query = `${latitude},${longitude}`;
    } else {
        query = [location.address?.trim(), location.city?.trim()].filter(Boolean).join(", ");
    }
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
