const USER_CACHE_KEY = "workhive_user_cache";
const CSRF_CACHE_KEY = "workhive_csrf_token";

export function clearSessionCache(): void {
    if (typeof window === "undefined") return;

    // Remove credentials created by versions prior to HttpOnly sessions.
    localStorage.removeItem("token");
    sessionStorage.removeItem(USER_CACHE_KEY);
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
