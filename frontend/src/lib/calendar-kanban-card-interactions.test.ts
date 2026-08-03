import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(
    new URL("../components/dashboard/CalendarKanbanCard.tsx", import.meta.url),
    "utf8",
);

test("kanban card opens task details from an accessible full-card control", () => {
    assert.match(
        card,
        /<button[\s\S]*?onClick=\{\(\) => onClick\(task\)\}/,
    );
    assert.match(card, /aria-label=\{`Abrir tarea: \$\{task\.title\}`\}/);
});
