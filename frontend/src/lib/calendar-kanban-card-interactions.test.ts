import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    getCalendarKanbanAssignee,
    parseCalendarKanbanChecklist,
} from "../components/dashboard/calendar-kanban-card-utils.ts";

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

test("kanban card identifies an assigned team instead of implying an unknown creator", () => {
    const task = {
        user_id: null,
        accepted_by_name: null,
        assignments: [{ user_id: 7, user_name: "Tester", status: "pending", source: "all" }],
    } as never;
    const assignee = getCalendarKanbanAssignee(
        task,
        () => "Sin asignar",
        () => ({ initials: "?", bgColor: "bg-neutral-600" }),
        "Aceptada por",
    );

    assert.deepEqual(assignee, {
        name: "Tester",
        initials: "T",
        label: "Asignada a Tester",
        backgroundClass: "bg-neutral-600",
    });
    assert.match(card, /getCalendarKanbanAssignee/);
});

test("kanban checklist parsing preserves optional assignees in one pass", () => {
    assert.deepEqual(
        parseCalendarKanbanChecklist("- [ ] Suelo (@7:Ana)\n- [x] Baño"),
        [
            { text: "Suelo", checked: false, assignedUserId: 7, assignedUserName: "Ana" },
            { text: "Baño", checked: true, assignedUserId: undefined, assignedUserName: undefined },
        ],
    );
});
