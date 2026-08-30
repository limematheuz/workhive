export const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "host",
    "keep-alive",
    "transfer-encoding",
]);

const ALLOWED_REQUEST_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "cookie",
    "user-agent",
    "x-csrf-token",
    "x-request-id",
];

type ProxyEnv = Partial<Record<"BACKEND_URL" | "NEXT_PUBLIC_API_URL" | "NODE_ENV", string>>;

export function getConfiguredBackendUrl(env: ProxyEnv = process.env as ProxyEnv): string {
    const configuredUrl = (
        env.BACKEND_URL
        || env.NEXT_PUBLIC_API_URL
        || ""
    ).replace(/\/+$/, "");

    if (configuredUrl || env.NODE_ENV !== "development") return configuredUrl;

    // Local worktrees may not have an ignored .env.local yet. Keep the
    // development server usable while production still requires explicit
    // backend configuration.
    return "http://localhost:8000";
}

export function buildProxyTarget(
    backendUrl: string,
    pathname: string,
    search: string,
): URL {
    const target = new URL(pathname, new URL(backendUrl));
    target.search = search;
    return target;
}

export function copyAllowedRequestHeaders(source: Headers): Headers {
    const requestHeaders = new Headers();
    for (const header of ALLOWED_REQUEST_HEADERS) {
        const value = source.get(header);
        if (value) requestHeaders.set(header, value);
    }
    return requestHeaders;
}

export function copyProxyResponseHeaders(
    source: Headers & { getSetCookie?: () => string[] },
): Headers {
    const responseHeaders = new Headers();
    source.forEach((value, key) => {
        const header = key.toLowerCase();
        if (!HOP_BY_HOP_HEADERS.has(header) && header !== "set-cookie") {
            responseHeaders.append(key, value);
        }
    });
    const cookieHeaders = source.getSetCookie?.() || [];
    cookieHeaders.forEach((cookie) => responseHeaders.append("set-cookie", cookie));
    return responseHeaders;
}
