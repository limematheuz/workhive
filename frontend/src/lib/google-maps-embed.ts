export function buildGoogleMapsEmbedUrl(addressQuery: string): string {
    return `https://maps.google.com/maps?f=q&source=s_q&hl=es&q=${encodeURIComponent(addressQuery)}&z=15&output=embed`;
}

/**
 * Google Maps embed iframes must not use a restrictive sandbox attribute.
 * Without allow-same-origin, Google's nested frames throw SecurityError when
 * main.js calls window.addEventListener across sandboxed frames.
 */
export function shouldSandboxGoogleMapsEmbed(): boolean {
    return false;
}
