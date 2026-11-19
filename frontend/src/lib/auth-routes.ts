export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export const APPLICATION_PATHS = ["/worker", "/portal-cliente", "/gestoria"] as const;

export function isDedicatedApplicationPath(pathname: string): boolean {
    return APPLICATION_PATHS.some(path => pathname === path || pathname.startsWith(path + "/"));
}

function isDashboardPath(pathname: string): boolean {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/**
 * Paths that need a signed-in user before they can perform their action.
 * The purchase checkout remains public: a new customer has no session until
 * Stripe confirms payment and the one-time activation link creates the owner.
 */
export function requiresAuthenticatedSession(pathname: string): boolean {
    return isDashboardPath(pathname) || isDedicatedApplicationPath(pathname);
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
        requiresAuthenticatedSession(pathname) ||
        pathname === "/accept-company-invitation" ||
        pathname === "/accesos";

    return isSupported
        ? `${pathname}${candidate.search}`
        : DEFAULT_POST_LOGIN_PATH;
}

/** The route changes presentation only; each application/API still checks its own permissions. */
export type ApplicationIdentity={role?:{name?:string};can_view_finance?:boolean;can_view_labor_costs?:boolean;can_view_quality?:boolean;can_manage_work_reports?:boolean;can_manage_work?:boolean;can_view_tasks?:boolean;can_manage_time?:boolean};
export function applicationHome(identity: string | ApplicationIdentity | undefined, requested = DEFAULT_POST_LOGIN_PATH): string {
    const role=typeof identity==="string"?identity:identity?.role?.name;
    const office=typeof identity==="object"&&Boolean(identity.can_view_finance||identity.can_view_labor_costs||identity.can_view_quality||identity.can_manage_work||identity.can_manage_work_reports);
    const fieldAccess=typeof identity!=="object"||identity.can_view_tasks!==false||identity.can_manage_time!==false;
    if (requested !== DEFAULT_POST_LOGIN_PATH) return requested;
    if (role === "client_portal") return "/portal-cliente";
    if (role === "external_portal") return "/gestoria";
    if (role === "viewer"&&!office&&fieldAccess) return "/worker";
    return DEFAULT_POST_LOGIN_PATH;
}
export type ApplicationKind = "worker" | "client" | "adviser";
export function applicationRoleAllowed(kind: ApplicationKind, role: string | undefined, company: number | null | undefined): boolean {
    if (kind === "client") return role === "client_portal";
    if (kind === "adviser") return role === "external_portal";
    return Boolean(company && ["admin", "manager", "viewer"].includes(role ?? ""));
}
