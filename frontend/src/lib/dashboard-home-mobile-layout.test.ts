import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

/** Fail if a class string pins a min-width that cannot fit a 375px phone. */
function assertNoPhoneBreakingMinWidth(label: string, text: string) {
    const matches = text.match(/min-w-\[[^\]]+\]/g) ?? [];
    for (const token of matches) {
        const rem = token.match(/min-w-\[(\d+(?:\.\d+)?)rem\]/);
        if (rem && Number(rem[1]) > 18) {
            assert.fail(`${label} has phone-breaking ${token}`);
        }
        const px = token.match(/min-w-\[(\d+(?:\.\d+)?)px\]/);
        if (px && Number(px[1]) > 300) {
            assert.fail(`${label} has phone-breaking ${token}`);
        }
    }
    assert.doesNotMatch(
        text,
        /min-w-(?:72|80|96)\b/,
        `${label} should not use Tailwind min-w-72+ on the dashboard home`,
    );
}

test("dashboard home keeps mobile/tablet grids usable through lg", () => {
    const stats = source("../components/dashboard/superadmin/SuperadminStatsCards.tsx");
    const nav = source("../components/dashboard/superadmin/SuperadminNavCards.tsx");
    const activity = source("../components/dashboard/superadmin/SuperadminActivityPanels.tsx");
    const hub = source("../components/dashboard/superadmin/SuperadminDashboard.tsx");
    const tech = source("../components/dashboard/TechDashboard.tsx");
    const layout = source("../app/dashboard/layout.tsx");
    const header = source("../components/dashboard/DashboardHeader.tsx");
    const pageHeader = source("../components/ui/page-header.tsx");

    // Metrics: 2 cols on phone/tablet, denser only from lg+
    assert.match(stats, /grid-cols-2[^"]*lg:grid-cols-3[^"]*xl:grid-cols-6/);
    assert.doesNotMatch(stats, /sm:grid-cols-3/);
    assert.match(stats, /min-w-0/);

    // Nav: stack on phone, 2-col tablet, 3-col desktop xl
    assert.match(nav, /grid-cols-1[^"]*md:grid-cols-2[^"]*xl:grid-cols-3/);
    assert.match(nav, /min-w-0/);

    // Activity panels full-width until lg
    assert.match(activity, /grid-cols-1[^"]*lg:grid-cols-2|grid min-w-0 grid-cols-1 gap-2\.5 lg:grid-cols-2/);
    assert.match(activity, /min-w-0/);

    assert.match(hub, /dashboard-page-content[^"]*min-w-0[^"]*max-w-full/);
    assert.match(hub, /safe-area-inset/);

    assert.match(tech, /min-w-0 max-w-7xl|w-full min-w-0 max-w-7xl/);
    assert.match(tech, /grid-cols-1[^"]*lg:grid-cols-3/);
    assert.match(tech, /safe-area-inset-bottom/);

    // Shell clips backlight without trapping document scroll on mobile
    assert.match(layout, /pointer-events-none absolute inset-0 overflow-hidden/);
    assert.match(layout, /dashboard-shell-backlight/);
    assert.match(layout, /lg:overflow-y-auto/);
    assert.match(layout, /min-w-0/);

    assert.match(header, /truncate/);
    assert.match(header, /safe-area-inset/);
    assert.match(pageHeader, /min-w-0 max-w-full|min-w-0[^"]*max-w-full/);
    assert.match(pageHeader, /overflow-wrap:anywhere/);

    for (const [label, text] of [
        ["SuperadminStatsCards", stats],
        ["SuperadminNavCards", nav],
        ["SuperadminActivityPanels", activity],
        ["SuperadminDashboard", hub],
        ["TechDashboard", tech],
    ] as const) {
        assertNoPhoneBreakingMinWidth(label, text);
    }
});
