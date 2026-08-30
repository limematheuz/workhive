export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

function isDashboardPath(pathname: string): boolean {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/**
 * Paths that need a signed-in user before they can perform their action.
 * The purchase checkout remains public: a new customer has no session until
 * Stripe confirms payment and the one-time activation link creates the owner.
 */
export function requiresAuthenticatedSession(pathname: string): boolean {
    return isDashboardPath(pathname);
}

/**
 * The entry screens are never useful to an already authenticated user.
 * Recovery and invitation routes are deliberately excluded: they can be
 * reached from a valid session as part of their own flows.
 */
export function isAuthenticationEntryPath(pathname: string): boolean {
    return pathname === "/login" || pathname === "/register";
}

/**
 * Keeps post-login navigation on a local, explicitly supported application
 * route. This prevents an untrusted `next` parameter from becoming an open
 * redirect while retaining the checkout query string.
 */
export function resolvePostLoginPath(
    next: string | string[] | undefined,
): string {
    if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
        return DEFAULT_POST_LOGIN_PATH;
    }

    const candidate = new URL(next, "https://workhive.local");
    const pathname = candidate.pathname;
    const isSupported =
        isDashboardPath(pathname) ||
        pathname === "/accept-company-invitation";

    return isSupported
        ? `${pathname}${candidate.search}`
        : DEFAULT_POST_LOGIN_PATH;
}
