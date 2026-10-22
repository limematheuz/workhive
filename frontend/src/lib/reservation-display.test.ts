import assert from "node:assert/strict";
import test from "node:test";

import {
    formatReservationDate,
    formatReservationDateTime,
    formatReservationTime,
} from "../features/reservations/reservation-display.ts";

test("reservation display uses the browser's local zone across daylight saving changes", () => {
    const zone = "Europe/Madrid";

    assert.equal(formatReservationTime("2026-10-23T14:00:00Z", "es-ES", zone), "16:00");
    assert.equal(formatReservationTime("2026-10-25T10:00:00Z", "es-ES", zone), "11:00");
    assert.match(formatReservationDate("2026-10-25T10:00:00Z", "es-ES", zone), /25 oct/i);
    assert.match(formatReservationDateTime("2026-10-25T10:00:00Z", "es-ES", zone), /11:00/);
});

test("reservation display waits for hydration before showing local times", () => {
    assert.equal(formatReservationTime("2026-10-23T14:00:00Z", "es-ES", null), "—");
    assert.equal(formatReservationDate("2026-10-23T14:00:00Z", "es-ES", null), "—");
    assert.equal(formatReservationDateTime("2026-10-23T14:00:00Z", "es-ES", null), "—");
});
