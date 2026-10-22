const ACCOUNTANT_ALLOWED_DASHBOARD_PATHS = new Set([
    "/dashboard/analytics",
    "/dashboard/expenses",
    "/dashboard/fiscal-summary",
    "/dashboard/profile",
]);

export function canAccessExternalPortalDashboardPath(pathname: string): boolean {
    return ACCOUNTANT_ALLOWED_DASHBOARD_PATHS.has(pathname);
}
