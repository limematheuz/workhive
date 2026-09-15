import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("task editors reuse local shadcn inputs and selects", () => {
    const pricing = source("../components/tasks/TaskEditPricingSection.tsx");
    const status = source("../components/tasks/TaskEditStatusSection.tsx");
    const reservations = source("../components/tasks/TaskCreateReservationSection.tsx");

    for (const control of [pricing, status, reservations]) {
        assert.match(control, /from "@\/components\/ui\/select"/);
        assert.match(control, /<SelectTrigger/);
        assert.doesNotMatch(control, /<(?:input|select)\b/);
    }

    assert.match(pricing, /from "@\/components\/ui\/input"/);
    assert.match(pricing, /<Input/);
    assert.match(reservations, /NO_RESERVATION_ID/);
    assert.match(reservations, /value === NO_RESERVATION_ID \? "" : value/);
});
