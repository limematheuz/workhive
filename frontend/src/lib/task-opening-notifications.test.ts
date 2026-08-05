import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("opening a task from every operational entry point acknowledges its alert", () => {
    const operationsCalendar = read("../hooks/useOperationsCalendar.ts");
    const taskCrud = read("../hooks/useTaskCrud.ts");
    const techDashboard = read("../components/dashboard/TechDashboard.tsx");
    const companyCalendar = read("../components/calendar/CompanyCalendar.tsx");
    const clientsPage = read("../app/dashboard/clients/page.tsx");
    const notifications = read("../components/dashboard/notifications/useNotifications.ts");

    for (const source of [operationsCalendar, taskCrud, techDashboard]) {
        assert.match(source, /acknowledgeTaskOpened/);
        assert.match(source, /acknowledgeTaskOpened\(currentUser\.id, task\)/);
    }

    assert.match(companyCalendar, /acknowledgeTaskOpened\(currentUser\.id, task\)/);
    assert.match(clientsPage, /acknowledgeTaskOpened\(user\.id, task\)/);
    assert.match(notifications, /acknowledgeTaskOpened\(userId, currentTask\)/);
});

test("persistent task events are acknowledged by task rather than one row at a time", () => {
    const notifications = read("../components/dashboard/notifications/useNotifications.ts");

    assert.match(notifications, /NotificationService\.markTaskItemRead\(taskItemId\)/);
    assert.match(notifications, /pendingTaskAcknowledgementsRef/);
});
