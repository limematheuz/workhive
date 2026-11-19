import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("overview groups old work once and keeps the four daily operational counters", () => {
    const overview = read("../components/dashboard/overview/OperationsDashboard.tsx");
    const metrics = read("../components/dashboard/overview/OverviewMetrics.tsx");
    const attention = read("../components/dashboard/overview/OverviewAttention.tsx");
    assert.match(metrics, /c\.scheduledLocations/);
    assert.match(metrics, /Trabajadores asignados/);
    assert.match(metrics, /Trabajos terminados/);
    assert.match(metrics, /c\.unassigned/);
    assert.doesNotMatch(metrics, /incidents|sessions/);
    assert.doesNotMatch(overview, /wh-overview-progress-strip|extra\.time/);
    assert.match(overview, /todayData = buildOperationsOverview\(tasks, overviewRange\("today"/);
    assert.match(attention, /items: data\.carriedOver/);
    assert.doesNotMatch(attention, /priority\.slice|row\.task\.title/);
    assert.match(attention, /onList\(notice\.title, notice\.items\)/);
});

test("overview breakpoints follow usable interior width and never generate three KPI columns", () => {
    const css = read("../components/dashboard/overview/operations-overview.module.css");
    assert.match(css, /@container operationsOverview \(min-width: 760px\)/);
    assert.match(css, /@container overviewNumbers \(min-width: 650px\)/);
    assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
    assert.doesNotMatch(css, /repeat\(3,/);
    const filters = read("../components/tasks/tasks-list-filters.module.css");
    assert.match(filters, /container: taskFilters/);
    assert.match(filters, /min-width: 600px/);
    assert.match(filters, /min-width: 950px/);
});
