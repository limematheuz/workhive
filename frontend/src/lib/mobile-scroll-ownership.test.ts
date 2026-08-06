import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile screens have one explicit native vertical scroll owner", () => {
    const dashboardLayout = read("../app/dashboard/layout.tsx");
    const authShell = read("../components/auth/AuthShell.tsx");
    const css = read("../app/globals.css");

    assert.match(dashboardLayout, /h-dvh/);
    assert.match(dashboardLayout, /app-touch-scroll dashboard-page-scroll-region/);
    assert.match(dashboardLayout, /overflow-x-hidden overflow-y-auto/);
    assert.doesNotMatch(dashboardLayout, /flex-1 overflow-auto/);
    assert.match(authShell, /app-touch-scroll/);
    assert.match(authShell, /overflow-y-auto/);
    assert.match(css, /\.app-touch-scroll\s*\{[\s\S]*touch-action: pan-y pinch-zoom;/);
    assert.doesNotMatch(css, /\.app-touch-scroll\s*\{[\s\S]*overscroll-behavior-y:/);
});

test("dashboard pages do not create competing vertical scroll containers", () => {
    const pagePaths = [
        "../app/dashboard/calendar/page.tsx",
        "../app/dashboard/clients/page.tsx",
        "../app/dashboard/invoices/page.tsx",
        "../app/dashboard/invoices/[id]/page.tsx",
        "../app/dashboard/locations/page.tsx",
        "../app/dashboard/quotes/page.tsx",
        "../app/dashboard/task-reports/page.tsx",
        "../app/dashboard/tasks/page.tsx",
        "../app/dashboard/traffic/page.tsx",
        "../app/dashboard/users/page.tsx",
    ];

    for (const path of pagePaths) {
        const source = read(path);
        assert.match(source, /dashboard-page-content/);
        assert.doesNotMatch(source, /h-full[^"`]*overflow-y-auto|overflow-y-auto[^"`]*h-full/);
    }
});
