import assert from "node:assert/strict";
import test from "node:test";

import {
    isExternalTaskForCompany,
    localizeTaskDescription,
    localizeTaskTitle,
    taskLocationTitle,
} from "./task-display.ts";
import type { TaskItem } from "../types/user.ts";

function task(overrides: Partial<TaskItem>): TaskItem {
    return {
        id: 1,
        title: "Checkout Cleaning - Casa",
        description: null,
        notes: null,
        price: 0,
        quantity: 1,
        unit: "service",
        template_task_id: null,
        location_id: 0,
        user_id: null,
        status: "pending",
        priority: "medium",
        scheduled_start_at: null,
        due_at: null,
        date_done: null,
        is_invoiced: false,
        created_at: "2026-07-05T10:00:00",
        updated_at: "2026-07-05T10:00:00",
        ...overrides,
    };
}

test("task title and checkout descriptions are localized for Spanish UI", () => {
    assert.equal(
        localizeTaskTitle("Checkout Cleaning - Casa Javier"),
        "Limpieza de salida - Casa Javier",
    );
    assert.equal(
        localizeTaskDescription("Service requested for the checkout of a reservation of 4 guests."),
        "Servicio solicitado para la salida de una reserva de 4 huéspedes.",
    );
    assert.equal(localizeTaskDescription(null), null);
});

test("task location title appends location only when missing", () => {
    assert.equal(
        taskLocationTitle(task({ title: "Limpieza especial" }), "Casa Javier"),
        "Limpieza especial - Casa Javier",
    );
    assert.equal(
        taskLocationTitle(task({ title: "Limpieza especial - Casa Javier" }), "Casa Javier"),
        "Limpieza especial - Casa Javier",
    );
    assert.equal(
        taskLocationTitle(task({ title: "Limpieza especial" }), ""),
        "Limpieza especial",
    );
});

test("external task detection compares reservation owner with current company", () => {
    assert.equal(
        isExternalTaskForCompany(task({
            checkout_reservation: { owner_company_id: 20 } as TaskItem["checkout_reservation"],
        }), 10),
        true,
    );
    assert.equal(
        isExternalTaskForCompany(task({
            checkout_reservation: { owner_company_id: 10 } as TaskItem["checkout_reservation"],
        }), 10),
        false,
    );
    assert.equal(isExternalTaskForCompany(task({ checkout_reservation: null }), 10), false);
});
