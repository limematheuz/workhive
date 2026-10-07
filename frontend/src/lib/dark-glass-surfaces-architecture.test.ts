import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("companies admin surfaces use billing shells and keep the dashboard glow static", () => {
    const list = read("../components/companies/CompaniesListSection.tsx");
    const members = read("../components/companies/CompanyMembersPanel.tsx");
    const trials = read("../components/companies/TrialRequestsPanel.tsx");
    const globals = read("../app/globals.css");

    assert.match(list, /billing-surface/);
    assert.match(list, /from "@\/components\/ui\/table"/);
    assert.doesNotMatch(list, /surface-glass-card/);
    assert.match(members, /billing-block/);
    assert.doesNotMatch(members, /glass-panel/);
    assert.match(trials, /billing-surface/);
    assert.doesNotMatch(trials, /surface-glass-card/);
    assert.match(globals, /\.surface-glass-card/);
    assert.match(globals, /--surface-card-bg:\s*rgba\(44,\s*44,\s*48,\s*0\.88\)/);

    // Ambient shell glow keeps its visual depth without a continuously composited filter.
    const backlightBlock = globals.match(/\.dashboard-shell-backlight\s*\{[^}]+\}/)?.[0] ?? "";
    assert.match(backlightBlock, /opacity:\s*0\.3/);
    assert.doesNotMatch(backlightBlock, /filter:/);
    assert.doesNotMatch(backlightBlock, /animation:/);
    assert.match(
        globals,
        /\.dashboard-shell-backlight\s*\{[\s\S]*?radial-gradient\(circle at 48% 86%/,
    );
});

test("task list cards and filters use billing surfaces with readable metadata", () => {
    const card = read("../components/tasks/TaskListCard.tsx");
    const filters = read("../components/tasks/TasksListFilters.tsx");
    const list = read("../components/tasks/TasksList.tsx");

    assert.match(card, /billing-block/);
    assert.match(card, /color-mix\(in_srgb,var\(--text-muted\)_55%,var\(--text-main\)\)/);
    assert.match(filters, /billing-block/);
    assert.match(list, /billing-block/);
    assert.doesNotMatch(card, /dashboard-shell-backlight/);
    assert.doesNotMatch(card, /surface-glass-card/);
});
