import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(
    new URL("../components/dashboard/CalendarKanbanCard.tsx", import.meta.url),
    "utf8",
);

test("kanban card opens task details from the card surface", () => {
    assert.match(
        card,
        /<article[\s\S]*?onClick=\{\(\) => onClick\(task\)\}/,
    );
    assert.match(card, /tabIndex=\{0\}/);
});
