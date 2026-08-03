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
