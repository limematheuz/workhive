const PARTNER_PORTAL_ALLOWED_DASHBOARD_PATHS = new Set([
    "/dashboard/partner",
    "/dashboard/partner/properties",
    "/dashboard/partner/requests",
    "/dashboard/partner/profile",
]);

/** Keep a sponsored partner inside its deliberately small operational portal. */
export function canAccessPartnerPortalDashboardPath(pathname: string): boolean {
    return PARTNER_PORTAL_ALLOWED_DASHBOARD_PATHS.has(pathname);
}
