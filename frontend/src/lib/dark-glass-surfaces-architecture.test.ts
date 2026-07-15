import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("companies admin surfaces use frosted glass without changing dashboard backlight", () => {
    const list = read("../components/companies/CompaniesListSection.tsx");
    const members = read("../components/companies/CompanyMembersPanel.tsx");
    const trials = read("../components/companies/TrialRequestsPanel.tsx");
    const globals = read("../app/globals.css");

    assert.match(list, /surface-glass-card/);
    assert.match(members, /glass-panel/);
    assert.match(trials, /surface-glass-card/);
    assert.match(globals, /\.surface-glass-card/);
    assert.match(globals, /rgba\(52,\s*52,\s*56,\s*0\.74\)/);

    // Ambient shell glow must remain untouched.
    assert.match(globals, /\.dashboard-shell-backlight\s*\{[^}]*opacity:\s*0\.34/s);
    assert.match(
        globals,
        /\.dashboard-shell-backlight\s*\{[^}]*radial-gradient\(circle at 48% 86%/s,
    );
});

test("task list cards and filters stay visible in dark glass surfaces", () => {
    const card = read("../components/tasks/TaskListCard.tsx");
    const filters = read("../components/tasks/TasksListFilters.tsx");
    const list = read("../components/tasks/TasksList.tsx");

    assert.match(card, /surface-glass-card/);
    assert.match(card, /color-mix\(in_srgb,var\(--text-muted\)_55%,var\(--text-main\)\)/);
    assert.match(filters, /surface-glass-card/);
    assert.match(list, /surface-glass-card/);
    assert.doesNotMatch(card, /dashboard-shell-backlight/);
});
