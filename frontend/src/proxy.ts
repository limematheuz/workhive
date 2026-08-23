import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
    getCanonicalAppHost,
    shouldRedirectPublicAppRoute,
} from "@/lib/public-site";

function getApiOrigin(): string {
    if (process.env.NODE_ENV === "production") return "";
    try {
        return process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
            : "";
    } catch {
        return "";
    }
}

function createContentSecurityPolicy(nonce: string): string {
    const apiOrigin = getApiOrigin();
    const developmentConnections = process.env.NODE_ENV === "development"
        ? "ws://localhost:* http://localhost:*"
        : "";
    const developmentScripts = process.env.NODE_ENV === "development"
        ? "'unsafe-eval'"
        : "";

    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        `connect-src 'self' ${apiOrigin} ${developmentConnections}`.trim(),
        `img-src 'self' data: blob: ${apiOrigin}`.trim(),
        "frame-src 'self' https://www.google.com https://maps.google.com",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${developmentScripts}`.trim(),
        ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
}

function applySecurityHeaders(response: NextResponse, policy: string): NextResponse {
    response.headers.set("Content-Security-Policy", policy);
    return response;
}

function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return true;

        const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload: unknown = JSON.parse(atob(payloadBase64));

        if (!payload || typeof payload !== "object" || !("exp" in payload)) return true;
        const expiration = (payload as { exp?: unknown }).exp;
        return typeof expiration !== "number" || expiration < Date.now() / 1000;
    } catch {
        return true;
    }
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const nonce = btoa(crypto.randomUUID());
    const contentSecurityPolicy = createContentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

    if (shouldRedirectPublicAppRoute(request.headers.get("host"), pathname)) {
        const appDomain = getCanonicalAppHost();
        if (appDomain) {
            const appUrl = new URL(`${pathname}${request.nextUrl.search}`, `https://${appDomain}`);
            return applySecurityHeaders(
                NextResponse.redirect(appUrl, 308),
                contentSecurityPolicy,
            );
        }
    }

    let token = request.cookies.get("auth_token")?.value;

    if (token && isTokenExpired(token)) {
        token = undefined;
    }

    const isDashboardRoute = pathname.startsWith("/dashboard");

    if (isDashboardRoute && !token) {
        const loginUrl = new URL("/login", request.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
        return applySecurityHeaders(response, contentSecurityPolicy);
    }

    return applySecurityHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
        contentSecurityPolicy
    );
}

export const config = {
    matcher: [
        {
            source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
