import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    filterVisibleChecklistItems,
    getChecklistProgress,
    getFirstPendingChecklistItem,
} from "./task-checklist-view.ts";

const items = [
    { id: "one", answer: "yes" as const },
    { id: "two", answer: null },
    { id: "three", answer: "no" as const },
];

const dialogSource = readFileSync(
    new URL("../components/dashboard/tech-task/TechTaskChecklistDialog.tsx", import.meta.url),
    "utf8",
);

test("checklist progress treats both yes and no as answered requirements", () => {
    assert.deepEqual(getChecklistProgress(items), {
        completed: 2,
        pending: 1,
        total: 3,
        percentage: 67,
    });
});

test("empty checklist progress never divides by zero", () => {
    assert.deepEqual(getChecklistProgress([]), {
        completed: 0,
        pending: 0,
        total: 0,
        percentage: 0,
    });
});

test("hide completed removes answered items without mutating source order", () => {
    assert.deepEqual(
        filterVisibleChecklistItems(items, true).map(item => item.id),
        ["two"],
    );
    assert.deepEqual(items.map(item => item.id), ["one", "two", "three"]);
    assert.equal(filterVisibleChecklistItems(items, false), items);
});

test("next pending action selects first unanswered item and handles completion", () => {
    assert.equal(getFirstPendingChecklistItem(items)?.id, "two");
    assert.equal(getFirstPendingChecklistItem(items.map(item => ({ ...item, answer: "yes" as const }))), null);
});

test("mobile checklist owns one vertical scroll and keeps its translucent footer visible", () => {
    assert.equal(dialogSource.match(/overflow-y-auto/g)?.length, 1);
    assert.match(dialogSource, /h-\[100dvh\]/);
    assert.match(dialogSource, /scrollbar-width:none/);
    assert.match(dialogSource, /backdrop-blur-xl/);
    assert.match(dialogSource, /shrink-0/);
});

test("requirement cards keep compact pill controls in a single action row", () => {
    assert.match(dialogSource, /fieldset className="mt-2\.5 flex items-center justify-between/);
    assert.match(dialogSource, /dict\.tech\.yes_label/);
    assert.match(dialogSource, /dict\.tech\.no_label/);
    assert.doesNotMatch(dialogSource, /\{dict\.tech\.btn_yes\}/);
    assert.match(dialogSource, /items-start justify-between/);
    assert.match(dialogSource, /Pencil/);
    assert.match(dialogSource, /Camera/);
    assert.doesNotMatch(dialogSource, /hover:border-red-500/);
});

test("checklist categories use the shared app tabs", () => {
    assert.match(dialogSource, /<PremiumTabs/);
    assert.match(dialogSource, /activeTab=\{activeCategory\}/);
});
