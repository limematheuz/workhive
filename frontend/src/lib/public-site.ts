import type { Metadata } from "next";

export const PUBLIC_SITE_METADATA: Metadata = {
    title: "WorkHive | Gestión para empresas de servicios",
    description:
        "Planifica trabajos, coordina equipos, registra horas y gestiona presupuestos y facturación con WorkHive.",
    alternates: { canonical: "https://workhive.es" },
    openGraph: {
        title: "WorkHive | Gestión para empresas de servicios",
        description: "Operaciones, equipos y facturación conectados en una única plataforma.",
        url: "https://workhive.es",
        siteName: "WorkHive",
        type: "website",
    },
};

function normalizeHostname(value: string | null | undefined): string {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, "")
        .replace(/\.$/, "");
}

const APP_ONLY_PATHS = new Set([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/accept-invitation",
    "/confirm-email-change",
]);

export function isAppOnlyPath(pathname: string): boolean {
    return APP_ONLY_PATHS.has(pathname)
        || pathname === "/dashboard"
        || pathname.startsWith("/dashboard/")
        || pathname === "/subscription"
        || pathname.startsWith("/subscription/");
}

export function isPublicSiteHost(
    hostHeader: string | null,
    marketingDomain = process.env.MARKETING_DOMAIN ?? "localhost",
): boolean {
    const hostname = normalizeHostname(hostHeader);
    const domain = normalizeHostname(marketingDomain);

    return Boolean(domain) && (hostname === domain || hostname === `www.${domain}`);
}
