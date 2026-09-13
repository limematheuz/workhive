const CLIENT_PORTAL_ALLOWED_DASHBOARD_PATHS = new Set([
    "/dashboard/client",
    "/dashboard/client/profile",
]);

/** Keep a customer out of the provider's internal dashboard. */
export function canAccessClientPortalDashboardPath(pathname: string): boolean {
    return CLIENT_PORTAL_ALLOWED_DASHBOARD_PATHS.has(pathname);
}
