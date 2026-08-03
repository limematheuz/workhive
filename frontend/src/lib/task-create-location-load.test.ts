import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadTaskCreateLocationData } from "./load-task-create-location-data.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const reservation = {
    id: 11,
    location_id: 42,
    owner_company_id: 1,
    check_in_at: "2026-07-23T12:00:00Z",
    check_out_at: "2026-07-24T10:00:00Z",
    guest_count: 2,
    stay_type: "guest" as const,
    status: "confirmed" as const,
    source: "manual",
    cleaning_required: true,
    created_at: "2026-07-20T12:00:00Z",
    updated_at: "2026-07-20T12:00:00Z",
};

const locationTemplate = {
    location_id: 42,
    template_task_id: 7,
    custom_price: null,
    template: {
        id: 7,
        name: "Limpieza",
        description: "- [ ] Suelo",
        default_price: 100,
        unit: "service",
        company_id: 1,
    },
};

test("task creation keeps reservations when location templates return 500", async () => {
    const templateError = new Error("Internal Server Error");
    const result = await loadTaskCreateLocationData(42, {
        getLocationTemplates: async () => {
            throw templateError;
        },
        getReservations: async () => [reservation],
    });

    assert.deepEqual(result.locationTemplates, []);
    assert.equal(result.locationTemplatesError, templateError);
    assert.deepEqual(result.reservations, [reservation]);
    assert.equal(result.reservationsError, null);
});

test("task creation keeps templates when reservations fail", async () => {
    const reservationError = new Error("Error loading reservations");
    const result = await loadTaskCreateLocationData(42, {
        getLocationTemplates: async () => [locationTemplate],
        getReservations: async () => {
            throw reservationError;
        },
    });

    assert.deepEqual(result.locationTemplates, [locationTemplate]);
    assert.equal(result.locationTemplatesError, null);
    assert.deepEqual(result.reservations, []);
    assert.equal(result.reservationsError, reservationError);
});

test("task create hook uses the safe loader without logging handled load errors", () => {
    const hook = read("../hooks/useTaskCrud.ts");
    const tasksPage = read("../hooks/useTasksPage.ts");
    const modal = read("../components/tasks/TaskCreateModal.tsx");

    assert.match(hook, /loadTaskCreateLocationData/);
    assert.match(hook, /canManageReservationsForLocation/);
    assert.match(tasksPage, /canLinkTaskReservations/);
    assert.match(modal, /canLinkTaskReservations/);
    assert.match(modal, /newLocationId && canLinkReservations/);
    assert.doesNotMatch(modal, /canManageLocationReservations/);
    assert.match(tasksPage, /if \(currentUser && !newUserId\)/);
    assert.doesNotMatch(hook, /console\.error\("Error fetching house templates"/);
    assert.doesNotMatch(hook, /console\.error\("Error loading location reservations"/);
});
