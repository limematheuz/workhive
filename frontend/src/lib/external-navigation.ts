const TRUSTED_EXTERNAL_HOSTS = new Set([
    "billing.stripe.com",
    "checkout.stripe.com",
]);

export function getTrustedExternalUrl(rawUrl: string): string {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !TRUSTED_EXTERNAL_HOSTS.has(url.hostname)) {
        throw new Error("The payment provider returned an invalid redirect URL.");
    }
    return url.toString();
}
