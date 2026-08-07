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
const checklistHookSource = readFileSync(
    new URL("../components/dashboard/tech-task/hooks/useTechTaskChecklist.ts", import.meta.url),
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

test("checklist requirements open in a centered dialog with one vertical scroll", () => {
    assert.equal(dialogSource.match(/overflow-y-auto/g)?.length, 1);
    assert.match(dialogSource, /h-\[min\(92dvh,760px\)\]/);
    assert.match(dialogSource, /w-\[calc\(100%-2rem\)\]/);
    assert.match(dialogSource, /scrollbar-width:none/);
    assert.match(dialogSource, /dialog-glass-chrome/);
    assert.match(dialogSource, /shrink-0/);
    assert.doesNotMatch(dialogSource, /!left-0/);
    assert.doesNotMatch(dialogSource, /!top-0/);
});

test("checklist dialog reuses billing-surface primitives and shadcn controls", () => {
    assert.match(dialogSource, /billing-block/);
    assert.match(dialogSource, /from "@\/components\/ui\/checkbox"/);
    assert.match(dialogSource, /from "@\/components\/ui\/label"/);
    assert.match(dialogSource, /from "@\/components\/ui\/badge"/);
    assert.match(dialogSource, /btn-cancel-muted/);
    assert.match(dialogSource, /border-none/);
    assert.match(dialogSource, /bg-accent/);
    assert.doesNotMatch(dialogSource, /absolute left-4 right-4 top-3(?: z-10)? h-1\.5 rounded-full bg-accent/);
    assert.doesNotMatch(dialogSource, /mb-2\.5 h-1 w-full rounded-full bg-accent/);
    // `relative` on DialogContent would twMerge-away the shared `fixed` position and hide the modal.
    assert.doesNotMatch(
        dialogSource,
        /DialogContent[\s\S]{0,400}className=\{cn\(\s*(?:\/\/[^\n]*\n\s*)*"relative /,
    );
});

test("requirement cards keep compact answer controls in a single action row", () => {
    assert.match(dialogSource, /fieldset className="mt-2\.5 flex items-center justify-between/);
    assert.match(dialogSource, /dict\.tech\.yes_label/);
    assert.match(dialogSource, /dict\.tech\.no_label/);
    assert.doesNotMatch(dialogSource, /\{dict\.tech\.btn_yes\}/);
    assert.match(dialogSource, /items-start justify-between/);
    assert.match(dialogSource, /Pencil/);
    assert.match(dialogSource, /Camera/);
    assert.doesNotMatch(dialogSource, /hover:border-red-500/);
    assert.doesNotMatch(dialogSource, /rounded-full border/);
});

test("checklist categories use the shared app tabs", () => {
    assert.match(dialogSource, /<PremiumTabs/);
    assert.match(dialogSource, /activeTab=\{activeCategory\}/);
});

test("a failed checklist save rolls the optimistic answer back instead of faking completion", () => {
    assert.match(checklistHookSource, /const restoreFailedAnswer/);
    assert.match(checklistHookSource, /setChecklist\(checklist\)/);
    assert.match(checklistHookSource, /No se pudo guardar el requisito/);
    assert.equal((checklistHookSource.match(/restoreFailedAnswer\(\)/g) || []).length, 2);
});
