export function buildGoogleMapsEmbedUrl(addressQuery: string): string {
    return `https://maps.google.com/maps?f=q&source=s_q&hl=es&q=${encodeURIComponent(addressQuery)}&z=15&output=embed`;
}

// Google Maps keeps its own origin and may open directions in a new tab. The
// sandbox blocks navigation of WorkHive and other privileged iframe features.
export const GOOGLE_MAPS_EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups";
