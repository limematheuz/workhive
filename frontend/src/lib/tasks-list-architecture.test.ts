import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("general task list uses compact rows without decorative top borders", () => {
    const card = read("../components/tasks/TaskListCard.tsx");
    const list = read("../components/tasks/TasksList.tsx");
    const filters = read("../components/tasks/TasksListFilters.tsx");

    assert.doesNotMatch(card, /border-t-\[3px\]/);
    assert.doesNotMatch(card, /min-h-\[180px\]/);
    assert.match(card, /rounded-xl/);
    assert.match(card, /px-3 py-2\.5|py-2\.5/);
    assert.match(list, /partitionTasksForGeneralList/);
    assert.match(list, /section_active|section_completed|Completadas/);
    assert.doesNotMatch(list, /lg:grid-cols-3/);
    assert.match(filters, /p-2\.5|p-3/);
});
