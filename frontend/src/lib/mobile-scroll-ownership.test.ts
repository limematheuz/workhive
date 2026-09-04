import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Classes on AuthShell `<main>` only (exclude backlight / children). */
function authShellMainClass(source: string): string {
    const match = source.match(/<main[\s\S]*?className=\{cn\(\s*"([^"]+)"/);
    assert.ok(match?.[1], "AuthShell main className not found");
    return match[1];
}

test("mobile screens use document scrolling and keep the desktop scroll region isolated", () => {
    const dashboardLayout = read("../app/dashboard/layout.tsx");
    const authShell = read("../components/auth/AuthShell.tsx");
    const resetPasswordPage = read("../app/(auth)/reset-password/page.tsx");
    const mainClass = authShellMainClass(authShell);

    assert.match(dashboardLayout, /min-h-dvh/);
    assert.match(dashboardLayout, /lg:h-dvh lg:overflow-hidden/);
    assert.match(dashboardLayout, /dashboard-page-scroll-region/);
    assert.match(dashboardLayout, /lg:overflow-y-auto/);
    assert.match(dashboardLayout, /pointer-events-none absolute inset-0 overflow-hidden/);
    assert.match(dashboardLayout, /dashboard-shell-backlight/);
    assert.doesNotMatch(dashboardLayout, /app-touch-scroll/);
    assert.doesNotMatch(dashboardLayout, /overflow-y-auto p-0/);

    // Document is the scroll owner: AuthShell main must not create a scrollport.
    // overflow-x:hidden/clip pairs to overflow-y:auto/clip and traps touch pans.
    assert.doesNotMatch(mainClass, /overflow-x-(?:hidden|clip|auto|scroll)/);
    assert.doesNotMatch(mainClass, /overflow-y-(?:auto|scroll|hidden|clip)/);
    assert.doesNotMatch(mainClass, /\boverflow-(?:auto|scroll|hidden|clip)\b/);
    assert.doesNotMatch(mainClass, /app-touch-scroll/);
    assert.match(authShell, /absolute inset-0 overflow-hidden/);
    assert.match(authShell, /dashboard-shell-backlight/);
    assert.doesNotMatch(resetPasswordPage, /overflow-y-auto/);
});

test("dashboard pages do not create competing vertical scroll containers", () => {
    const pagePaths = [
        "../app/dashboard/calendar/page.tsx",
        "../app/dashboard/clients/page.tsx",
        "../app/dashboard/invoices/page.tsx",
        "../app/dashboard/locations/page.tsx",
        "../app/dashboard/quotes/page.tsx",
        "../app/dashboard/task-reports/page.tsx",
        "../app/dashboard/tasks/page.tsx",
        "../app/dashboard/traffic/page.tsx",
    ];

    for (const path of pagePaths) {
        const source = read(path);
        assert.match(source, /dashboard-page-content/);
        assert.doesNotMatch(source, /h-full[^"`]*overflow-y-auto|overflow-y-auto[^"`]*h-full/);
    }

    const invoiceRoute = read("../app/dashboard/invoices/[id]/page.tsx");
    const invoiceDetail = read("../components/invoices/InvoiceDetailView.tsx");
    assert.match(invoiceRoute, /<InvoiceDetailView invoiceId=\{invoiceId\}/);
    assert.match(invoiceDetail, /min-h-0 flex-1 overflow-y-auto overflow-x-hidden/);
    assert.doesNotMatch(invoiceDetail, /h-full[^"`]*overflow-y-auto|overflow-y-auto[^"`]*h-full/);
});
