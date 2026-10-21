import assert from "node:assert/strict";
import test from "node:test";

import {
    buildFiscalCalendarDeadlines,
    buildUpcomingFiscalDeadlines,
    buildQuarterlyFiscalDeadlines,
    getFiscalDeadlineStatus,
} from "./fiscal-calendar.ts";

test("builds only the opted-in quarterly fiscal obligations", () => {
    const deadlines = buildQuarterlyFiscalDeadlines(2026, {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: false,
        reminderDays: 7,
    });

    assert.equal(deadlines.length, 4);
    assert.deepEqual(
        deadlines.map((deadline) => deadline.dueDate),
        ["2026-04-20", "2026-07-20", "2026-10-20", "2027-01-30"],
    );
    assert.ok(deadlines.every((deadline) => deadline.model === "303"));
    assert.equal(deadlines[0]?.reminderDate, "2026-04-13");
    assert.equal(deadlines.at(-1)?.periodLabel, "T4 2026");
});

test("keeps the two obligations separate when a company opts into both", () => {
    const deadlines = buildQuarterlyFiscalDeadlines(2026, {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: true,
        reminderDays: 14,
    });

    assert.equal(deadlines.length, 8);
    assert.deepEqual(
        deadlines.slice(0, 2).map((deadline) => deadline.model),
        ["303", "111"],
    );
    assert.equal(deadlines[0]?.periodLabel, "T1 2026");
    assert.equal(deadlines.at(-1)?.reminderDate, "2027-01-16");
});

test("fiscal calendar keeps the prior tax year's T4 payable in January", () => {
    const deadlines = buildFiscalCalendarDeadlines(2027, {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: false,
        reminderDays: 7,
    });

    assert.deepEqual(
        deadlines.map((deadline) => [deadline.model, deadline.periodLabel, deadline.dueDate]),
        [
            ["303", "T4 2026", "2027-01-30"],
            ["303", "T1 2027", "2027-04-20"],
            ["303", "T2 2027", "2027-07-20"],
            ["303", "T3 2027", "2027-10-20"],
        ],
    );
});

test("shows the next four payable quarters after the current year's last due date", () => {
    const deadlines = buildUpcomingFiscalDeadlines(new Date("2026-10-21T12:00:00"), {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: false,
        reminderDays: 7,
    });

    assert.deepEqual(
        deadlines.map((deadline) => [deadline.periodLabel, deadline.dueDate]),
        [
            ["T4 2026", "2027-01-30"],
            ["T1 2027", "2027-04-20"],
            ["T2 2027", "2027-07-20"],
            ["T3 2027", "2027-10-20"],
        ],
    );
});

test("includes a due date today and keeps the two enabled models separate", () => {
    const deadlines = buildUpcomingFiscalDeadlines(new Date("2026-10-20T12:00:00"), {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: true,
        reminderDays: 7,
    });

    assert.equal(deadlines.length, 8);
    assert.deepEqual(deadlines.slice(0, 2).map((deadline) => deadline.model), ["303", "111"]);
    assert.ok(deadlines.every((deadline) => deadline.dueDate >= "2026-10-20"));
});

test("marks deadlines as planned, upcoming, or overdue without changing their date", () => {
    const deadline = buildQuarterlyFiscalDeadlines(2026, {
        quarterlyVatEnabled: true,
        quarterlyWithholdingEnabled: false,
        reminderDays: 7,
    })[0];

    assert.ok(deadline);
    assert.equal(getFiscalDeadlineStatus(deadline, new Date("2026-04-10T12:00:00")), "planned");
    assert.equal(getFiscalDeadlineStatus(deadline, new Date("2026-04-15T12:00:00")), "upcoming");
    assert.equal(getFiscalDeadlineStatus(deadline, new Date("2026-04-21T12:00:00")), "overdue");
});
