export const USER_CACHE_KEY = "workhive_user_cache:v1";
export const LEGACY_USER_CACHE_KEY = "workhive_user_cache";
let sessionGeneration = 0;

/** Local partition only: never sent as a credential or authorization hint. */
export function getSessionReadContext(): string {
    if (typeof window === "undefined") return `${sessionGeneration}:server`;
    try {
        return `${sessionGeneration}:${sessionStorage.getItem(USER_CACHE_KEY) ?? sessionStorage.getItem(LEGACY_USER_CACHE_KEY) ?? "anonymous"}`;
    } catch {
        return `${sessionGeneration}:anonymous`;
    }
}
const CSRF_CACHE_KEY = "workhive_csrf_token";

export function clearSessionCache(): void {
    sessionGeneration++;
    if (typeof window === "undefined") return;

    // Remove credentials created by versions prior to HttpOnly sessions.
    localStorage.removeItem("token");
    sessionStorage.removeItem(USER_CACHE_KEY);
    sessionStorage.removeItem(LEGACY_USER_CACHE_KEY);
    sessionStorage.removeItem(CSRF_CACHE_KEY);
}

export function getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;

    const csrfCookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("csrf_token="));

    const cookieToken = csrfCookie ? decodeURIComponent(csrfCookie.split("=", 2)[1]) : null;
    if (cookieToken) {
        sessionStorage.setItem(CSRF_CACHE_KEY, cookieToken);
        return cookieToken;
    }

    return sessionStorage.getItem(CSRF_CACHE_KEY);
}

export function setCsrfToken(token: string): void {
    if (typeof window === "undefined") return;
    if (!token) {
        sessionStorage.removeItem(CSRF_CACHE_KEY);
        return;
    }
    sessionStorage.setItem(CSRF_CACHE_KEY, token);
}
