import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("general task list uses compact billing rows without decorative top borders", () => {
    const card = read("../components/tasks/TaskListCard.tsx");
    const list = read("../components/tasks/TasksList.tsx");
    const filters = read("../components/tasks/TasksListFilters.tsx");
    const page = read("../app/dashboard/tasks/page.tsx");

    assert.doesNotMatch(card, /border-t-\[3px\]/);
    assert.doesNotMatch(card, /min-h-\[180px\]/);
    assert.match(card, /billing-block/);
    assert.match(card, /rounded-2xl/);
    assert.match(card, /min-h-\[72px\]/);
    assert.match(card, /h-full/);
    assert.match(card, /from "@\/components\/ui\/badge"/);
    assert.match(card, /TaskStatusCheckbox|aria-pressed/);
    assert.match(card, /overflow-hidden/);
    assert.match(card, /dimmed && "opacity-70"/);
    assert.doesNotMatch(card, /surface-glass-card/);
    assert.doesNotMatch(card, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(card, /indigo-700|border-indigo|text-indigo-700|border-black|text-black/);

    assert.match(list, /items-stretch/);
    assert.match(list, /filterTasksForGeneralList/);
    assert.match(list, /paginateTaskListPage|TASK_LIST_PAGE_SIZE/);
    assert.match(list, /section_active|section_completed|Completadas/);
    assert.match(list, /Collapsible/);
    assert.match(list, /dimmed=\{true\}|dimmed/);
    assert.match(list, /billing-block/);
    assert.doesNotMatch(list, /lg:grid-cols-3/);
    assert.doesNotMatch(list, /surface-glass-card/);

    assert.match(filters, /billing-block/);
    assert.match(filters, /reservationFilterSelectClass|reservation-filter-styles/);
    assert.match(filters, /CompactFilterSelect/);
    assert.doesNotMatch(filters, /<select\b/);
    assert.match(filters, /flex flex-wrap gap-2/);
    assert.match(filters, /selectedPriority|filter_all_priorities/);
    assert.doesNotMatch(filters, /xl:grid-cols-6|2xl:grid-cols-6/);
    assert.doesNotMatch(filters, /surface-glass-card/);

    assert.match(page, /billing-surface/);
    assert.match(page, /PremiumTabs/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
});

test("completed task status and checkbox use accent, not green", () => {
    const card = read("../components/tasks/TaskListCard.tsx");

    assert.match(card, /bg-accent\/15 text-accent/);
    assert.match(card, /border-accent\/20 bg-accent\/10 text-accent/);
    assert.doesNotMatch(card, /color-green|text-green-|bg-green-|emerald/);
});
