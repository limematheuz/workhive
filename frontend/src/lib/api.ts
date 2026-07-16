import { clearSessionCache, getCsrfToken, setCsrfToken } from "./auth.ts";
import { createInflightRequestDeduper } from "./inflight-request.ts";

let activeMutationsCount = 0;
const dedupeRead = createInflightRequestDeduper();

export function hasActiveMutations(): boolean {
    return activeMutationsCount > 0;
}

const CSRF_EXEMPT_PATHS = new Set([
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/confirm-email-change",
    "/api/v1/user-invitations/accept",
    "/api/v1/contact/",
    "/api/v1/traffic/page-view",
]);

function getApiBaseUrl(): string {
    return "";
}

async function ensureCsrfToken(baseUrl: string): Promise<string | null> {
    const cachedToken = getCsrfToken();
    if (cachedToken) return cachedToken;

    const response = await fetch(`${baseUrl}/api/v1/auth/csrf`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });
    if (!response.ok) return null;

    const data = await response.json() as { csrf_token?: string };
    if (!data.csrf_token) return null;
    setCsrfToken(data.csrf_token);
    return data.csrf_token;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = getApiBaseUrl();

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${cleanPath}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }
    const method = (options.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (isMutation) activeMutationsCount++;

    try {
        if (isMutation) {
            const csrfToken = CSRF_EXEMPT_PATHS.has(cleanPath)
                ? getCsrfToken()
                : await ensureCsrfToken(baseUrl);
            if (csrfToken && !headers.has("X-CSRF-Token")) {
                headers.set("X-CSRF-Token", csrfToken);
            }
        }

        const execute = () => fetch(url, {
            ...options,
            headers,
            credentials: "include",
        });
        const headerKey = Array.from(headers.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, value]) => `${name}:${value}`)
            .join("|");
        let response = method === "GET"
            ? (await dedupeRead(`${method}:${url}:${headerKey}`, execute)).clone()
            : await execute();

        if (isMutation && response.status === 403) {
            const clonedResponse = response.clone();
            const errorData = await clonedResponse.json().catch(() => ({})) as { detail?: string };
            if (errorData.detail === "Invalid or missing CSRF token") {
                setCsrfToken("");
                const freshToken = await ensureCsrfToken(baseUrl);
                if (freshToken) {
                    headers.set("X-CSRF-Token", freshToken);
                    response = await fetch(url, {
                        ...options,
                        headers,
                        credentials: "include",
                    });
                }
            }
        }

        if (response.status === 401) {
            clearSessionCache();
            if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
                window.location.replace("/login");
            }
        }

        if (response.status === 402 && typeof window !== "undefined") {
            const clonedResponse = response.clone();
            const errorData = await clonedResponse.json().catch(() => ({})) as { detail?: string };
            const accessDeniedMessages = new Set([
                "The company trial has expired",
                "The company subscription payment is past due",
                "The company subscription has an unpaid invoice",
                "The company subscription has been canceled",
                "The company subscription is paused",
                "The company does not have an active subscription",
                "The company subscription setup is incomplete",
                "The incomplete company subscription has expired",
                "The company subscription does not allow access",
            ]);
            if (accessDeniedMessages.has(errorData.detail || "")) {
                clearSessionCache();
                if (window.location.pathname.startsWith("/dashboard")) {
                    window.location.replace("/login");
                }
            }
        }

        return response;
    } finally {
        if (isMutation) {
            activeMutationsCount = Math.max(0, activeMutationsCount - 1);
        }
    }
}

export function resolveApiMediaUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;

    const baseUrl = getApiBaseUrl();
    if (url.startsWith("/api/") || url.startsWith("/uploads")) {
        return `${baseUrl}${url}`;
    }

    try {
        const parsedUrl = new URL(url)
        if (parsedUrl.pathname.startsWith("/api/") || parsedUrl.pathname.startsWith("/uploads")) {
            return `${baseUrl}${parsedUrl.pathname}${parsedUrl.search}`;
        }
    } catch {
        return url;
    }

    return url;
}

export async function extractErrorMessage(response: Response, defaultMessage: string): Promise<string> {
    const responseForText = response.clone();
    try {
        const error: unknown = await response.json();
        if (!error || typeof error !== "object") {
            return defaultMessage;
        }
        const errorRecord = error as Record<string, unknown>;
        if (errorRecord.detail) {
            if (typeof errorRecord.detail === "string") {
                return errorRecord.detail;
            }
            if (Array.isArray(errorRecord.detail)) {
                return errorRecord.detail.map((entry: unknown) => {
                    if (entry && typeof entry === "object") {
                        const issue = entry as Record<string, unknown>;
                        if (typeof issue.msg === "string") {
                            const location = Array.isArray(issue.loc)
                                ? issue.loc.at(-1)
                                : null;
                            return location ? `${String(location)}: ${issue.msg}` : issue.msg;
                        }
                        return JSON.stringify(issue);
                    }
                    return String(entry);
                }).join(", ");
            }
            if (typeof errorRecord.detail === "object") {
                const detail = errorRecord.detail as Record<string, unknown>;
                return typeof detail.message === "string"
                    ? detail.message
                    : JSON.stringify(detail);
            }
        }
        return typeof errorRecord.message === "string"
            ? errorRecord.message
            : defaultMessage;
    } catch {
        const text = await responseForText.text().catch(() => "");
        return text.trim() || defaultMessage;
    }
}

export async function assertApiResponseOk(
    response: Response,
    defaultMessage: string,
): Promise<void> {
    if (response.ok) return;
    if (response.status >= 500) {
        throw new Error(defaultMessage);
    }
    throw new Error(await extractErrorMessage(response, defaultMessage));
}
