import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("tasks page shell uses billing surface without top accent pad", () => {
    const page = source("../app/dashboard/tasks/page.tsx");
    const list = source("../components/tasks/TasksList.tsx");
    const filters = source("../components/tasks/TasksListFilters.tsx");
    const card = source("../components/tasks/TaskListCard.tsx");
    const templates = source("../components/tasks/TasksTemplates.tsx");
    const filterStyles = source("../features/reservations/reservation-filter-styles.ts");

    assert.match(page, /billing-surface/);
    assert.match(page, /PremiumTabs/);
    assert.match(page, /PageHeader/);
    assert.doesNotMatch(page, /billing-surface-accent-pad/);
    assert.doesNotMatch(page, /absolute left-4 right-4 top-3 h-1\.5/);
    assert.doesNotMatch(page, /btn-cancel-muted/);

    assert.match(filters, /billing-block/);
    assert.match(filters, /reservation-filter-styles/);
    assert.match(filters, /value: "accepted"/);
    assert.match(filters, /from "@\/components\/ui\/input"/);
    assert.match(filters, /flex flex-wrap gap-2/);
    assert.match(filterStyles, /w-auto min-w-\[9\.5rem\]/);
    assert.doesNotMatch(filters, /xl:grid-cols-6|2xl:grid-cols-6/);

    assert.match(list, /Collapsible/);
    assert.match(list, /section_active/);
    assert.match(list, /section_completed/);
    assert.match(list, /renderCards\([^,]+,\s*true\)/);

    assert.match(card, /billing-block/);
    assert.match(card, /getTaskListDisplayStatus/);
    assert.match(card, /filter_accepted/);
    assert.match(card, /from "@\/components\/ui\/badge"/);
    assert.match(card, /dimmed && "opacity-70"/);
    assert.doesNotMatch(card, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(card, /surface-glass-card/);
    assert.doesNotMatch(card, /btn-cancel-muted/);

    assert.match(templates, /variant="plain"/);
    assert.match(templates, /DataListTable/);
});
