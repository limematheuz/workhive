import type { NextRequest } from "next/server";
import {
    buildProxyTarget,
    copyAllowedRequestHeaders,
    copyProxyResponseHeaders,
    getConfiguredBackendUrl,
} from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

async function proxyRequest(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
) {
    const backendUrl = getConfiguredBackendUrl();
    if (!backendUrl) {
        return Response.json(
            { detail: "Backend service is not configured" },
            { status: 503 },
        );
    }

    await context.params;
    const target = buildProxyTarget(
        backendUrl,
        request.nextUrl.pathname,
        request.nextUrl.search,
    );
    const requestHeaders = copyAllowedRequestHeaders(request.headers);

    const method = request.method.toUpperCase();
    const response = await fetch(target, {
        method,
        headers: requestHeaders,
        body: ["GET", "HEAD"].includes(method)
            ? undefined
            : await request.arrayBuffer(),
        redirect: "manual",
        cache: "no-store",
    });

    const responseHeaders = copyProxyResponseHeaders(
        response.headers as Headers & { getSetCookie?: () => string[] },
    );

    return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
    });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
