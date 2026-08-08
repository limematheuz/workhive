import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("live-work page uses billing surfaces without accent pad", () => {
    const page = source("../app/dashboard/live-work/page.tsx");
    const stats = source("../components/dashboard/live-work/LiveWorkStatsCards.tsx");
    const list = source("../components/dashboard/live-work/LiveWorkSessionList.tsx");

    assert.match(page, /billing-surface/);
    assert.match(page, /PageHeader/);
    assert.match(page, /PremiumTabs/);
    assert.match(page, /LiveWorkStatsCards/);
    assert.match(page, /LiveWorkSessionList/);
    assert.match(page, /from "@\/components\/ui\/input"/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /surface-glass-card/);
    assert.doesNotMatch(page, /btn-cancel-muted/);

    assert.match(stats, /billing-block/);
    assert.match(stats, /rounded-\[18px\]/);
    assert.doesNotMatch(stats, /surface-glass-card/);
    assert.doesNotMatch(stats, /emerald|color-green|text-green-|bg-green-/);

    assert.match(list, /billing-block/);
    assert.match(list, /from "@\/components\/ui\/badge"/);
    assert.match(list, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(list, /surface-glass-card/);
    assert.doesNotMatch(list, /emerald|color-green|text-green-|bg-green-/);
});
