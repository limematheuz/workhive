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

type ProxyEnv = Partial<Record<"BACKEND_URL" | "NEXT_PUBLIC_API_URL", string>>;

export function getConfiguredBackendUrl(env: ProxyEnv = process.env as ProxyEnv): string {
    return (
        env.BACKEND_URL
        || env.NEXT_PUBLIC_API_URL
        || ""
    ).replace(/\/+$/, "");
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
