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
    assert.match(card, /rounded-2xl/);
    assert.match(card, /min-h-\[72px\]/);
    assert.match(card, /h-full/);
    assert.match(card, /rounded-full/);
    assert.match(card, /solidContrastChip|bg-\[var\(--text-main\)\].*text-\[var\(--bg-card-solid\)\]|bg-\[var\(--text-main\)\]/);
    assert.match(card, /text-\[var\(--bg-card-solid\)\]/);
    assert.doesNotMatch(card, /indigo-700|border-indigo|text-indigo-700|border-black|text-black/);
    assert.match(card, /TaskStatusCheckbox|aria-pressed/);
    assert.match(card, /overflow-hidden/);
    assert.match(list, /items-stretch/);
    assert.match(list, /filterTasksForGeneralList/);
    assert.match(list, /paginateTaskListPage|TASK_LIST_PAGE_SIZE/);
    assert.match(list, /section_active|section_completed|Completadas/);
    assert.doesNotMatch(list, /lg:grid-cols-3/);
    assert.match(filters, /p-2\.5|p-3/);
    assert.match(filters, /selectedPriority|filter_all_priorities/);
});
