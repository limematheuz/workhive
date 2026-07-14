import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    CALENDAR_STATUS_SOFT_COLORS,
    isCalendarEventPast,
} from "./calendar-event-styling.ts";

test("calendar events that already ended are marked past", () => {
    assert.equal(isCalendarEventPast(new Date("2026-07-14T12:00:00Z"), new Date("2026-07-14T13:00:00Z")), true);
    assert.equal(isCalendarEventPast(new Date("2026-07-14T14:00:00Z"), new Date("2026-07-14T13:00:00Z")), false);
    assert.equal(isCalendarEventPast(null), false);
});

test("buildCalendarEvents marks past tasks via shared helper and status classes", () => {
    const source = readFileSync(new URL("../components/calendar/buildCalendarEvents.ts", import.meta.url), "utf8");
    assert.match(source, /isCalendarEventPast/);
    assert.match(source, /workhive-calendar-event-past/);
    assert.match(source, /workhive-calendar-event-\$\{normalizedStatus\}/);
    assert.match(source, /backgroundColor: "transparent"/);
});

test("calendar soft palette avoids the reference gym pastel colors", () => {
    const soft = Object.values(CALENDAR_STATUS_SOFT_COLORS);
    const forbidden = ["#86efac", "#bbf7d0", "#c4b5fd", "#f9a8d4", "#fde68a", "#fdba74"];
    for (const colors of soft) {
        assert.ok(!forbidden.includes(colors.background.toLowerCase()));
        assert.ok(!forbidden.includes(colors.accent.toLowerCase()));
    }
});

test("calendar board keeps event size contract and past styling hooks", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const board = readFileSync(new URL("../components/calendar/CalendarBoard.tsx", import.meta.url), "utf8");
    const content = readFileSync(new URL("../components/calendar/CalendarEventContent.tsx", import.meta.url), "utf8");

    assert.match(css, /workhive-calendar-event-past/);
    assert.match(css, /border-left: 4px solid/);
    assert.match(board, /eventClassNames/);
    assert.match(content, /px-2\.5 py-2/);
    assert.doesNotMatch(content, /border-l-2 border-white/);
});
