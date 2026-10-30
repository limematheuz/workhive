import assert from "node:assert/strict";
import test from "node:test";
import { buildTaskDuplicatePayload } from "../domain/tasks/task-duplicate.ts";
import type { TaskItem } from "../types/user";

test("duplication preserves the work definition and spaces without execution history", () => {
    const source = {
        id: 1, title: "Trabajo QA", notes: "Instrucciones", unit: "service",
        description: "<!-- workhive_assignees:7 -->\n- [x] Cocina (@7:Ana:completed)",
        location_id: 2, user_id: 7, status: "completed", priority: "high",
        price: 15, quantity: 2, pricing_mode: "fixed", template_task_id: 3,
        created_at: "2026-01-01", updated_at: "2026-01-02", is_invoiced: false,
        scheduled_start_at: "2026-01-01", due_at: "2026-01-02", date_done: "2026-01-02",
        pricing_locked_at: "2026-01-01", worked_seconds_snapshot: 60,
        checklist_evidence: { item_1: { answer: "yes", note: "Hecho" } },
        attachments: [{ url: "/media/qa.png", date: "2026-01-01" }],
        zones: [{ id: 8, space_id: 9, name: "Cocina", zone_type: "kitchen" }],
    } as TaskItem;
    const before = structuredClone(source);

    const payload = buildTaskDuplicatePayload(source);

    assert.deepEqual(payload, {
        title: "Trabajo QA (Copia)", notes: "Instrucciones", unit: "service",
        description: "<!-- workhive_assignees:7 -->\n- [ ] Cocina (@7:Ana:pending)",
        location_id: 2, user_id: 7, priority: "high", price: 15, quantity: 2,
        pricing_mode: "fixed", template_task_id: 3, zone_ids: [9],
    });
    assert.deepEqual(source, before);
});

test("duplication keeps hourly pricing and does not invent planning or instructions", () => {
    const payload = buildTaskDuplicatePayload({
        title: "Horas QA", unit: "hour", pricing_mode: "hourly", quantity: 1, price: 10,
        location_id: 2, user_id: null,
    } as TaskItem);

    assert.equal(payload.pricing_mode, "hourly");
    assert.equal(payload.unit, "hour");
    assert.equal(payload.description, null);
    assert.equal(payload.user_id, null);
    assert.equal("scheduled_start_at" in payload, false);
    assert.equal("worked_seconds_snapshot" in payload, false);
});
