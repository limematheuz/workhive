import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    canConnectCompanyCalendar,
    canManageCompanyCalendar,
    canManageCompanyTasks,
    canViewCompanyCalendar,
} from "../domain/access/roles.ts";
import {
    ALL_WORKERS_VALUE,
    buildChecklistDescription,
} from "../domain/tasks/task-create.ts";
import { buildTaskListFilters, parseTaskPageTab } from "../domain/tasks/task-list.ts";
import { canMoveTaskOnKanban, canDuplicateTask } from "../domain/tasks/task-permissions.ts";
import {
    getTasksForOverviewTab,
} from "../domain/tasks/task-schedule.ts";
import {
    canStartTaskWork,
    isTaskWorkInProgress,
    isOperationalStatus,
    toKanbanStatus,
} from "../domain/tasks/task-status.ts";
import { getTaskCalendarRange } from "./company-calendar.ts";
import {
    getUserChecklistItems,
    getUserTaskStatus,
    isTaskAssignedToUser,
    parseTaskChecklistItems,
    setChecklistAssigneeStatus,
} from "./format.ts";
import type { RoleName } from "../types/role.ts";
import type { TaskItem, User } from "../types/user.ts";

interface TaskVisibilityContract {
    cases: Array<{
        name: string;
        description: string;
        assignedUserIds: number[];
        unassignedUserIds: number[];
        checklistByUser?: Record<string, string[]>;
    }>;
}

const visibilityContract = JSON.parse(
    readFileSync(new URL("../../../test_contracts/task_visibility.json", import.meta.url), "utf8"),
) as TaskVisibilityContract;

function user(id: number, role: RoleName, fullName: string): User {
    return {
        id,
        email: `${role}${id}@workhive.test`,
        full_name: fullName,
        role_id: id,
        role: { id, name: role },
        company_id: 10,
        is_active: true,
    };
}

function task(overrides: Partial<TaskItem>): TaskItem {
    return {
        id: 100,
        title: "Turnover",
        description: null,
        notes: null,
        price: 0,
        quantity: 1,
        unit: "service",
        template_task_id: null,
        location_id: 50,
        user_id: null,
        status: "accepted",
        priority: "medium",
        scheduled_start_at: null,
        due_at: null,
        date_done: null,
        is_invoiced: false,
        created_at: "2026-07-06T08:00:00.000Z",
        updated_at: "2026-07-06T08:00:00.000Z",
        ...overrides,
    };
}

const admin = user(1, "admin", "Admin User");
const manager = user(2, "manager", "Manager User");
const viewer = user(3, "viewer", "Viewer User");
const secondViewer = user(4, "viewer", "Second Viewer");
const platformSuperadmin = {
    ...user(5, "superadmin", "Platform Admin"),
    company_id: null,
};
const allCompanyUsers = [admin, manager, viewer, secondViewer];

test("task and calendar permissions stay role-scoped", () => {
    assert.equal(canManageCompanyTasks(admin), true);
    assert.equal(canManageCompanyTasks(manager), true);
    assert.equal(canManageCompanyTasks(viewer), false);

    assert.equal(canViewCompanyCalendar(admin), true);
    assert.equal(canViewCompanyCalendar(manager), true);
    assert.equal(canViewCompanyCalendar(viewer), true);

    assert.equal(canManageCompanyCalendar(admin), true);
    assert.equal(canManageCompanyCalendar(manager), true);
    assert.equal(canManageCompanyCalendar(viewer), false);

    assert.equal(canConnectCompanyCalendar(admin), true);
    assert.equal(canConnectCompanyCalendar(manager), false);
    assert.equal(canConnectCompanyCalendar(viewer), false);
    assert.equal(canConnectCompanyCalendar(platformSuperadmin), false);
});

test("kanban movement is limited to managers/admins and mutable tasks", () => {
    const movableTask = task({ is_invoiced: false });
    const invoicedTask = task({ is_invoiced: true });

    assert.equal(canMoveTaskOnKanban(admin, movableTask), true);
    assert.equal(canMoveTaskOnKanban(manager, movableTask), true);
    assert.equal(canMoveTaskOnKanban(viewer, movableTask), false);
    assert.equal(canMoveTaskOnKanban(admin, invoicedTask), false);
    assert.equal(canMoveTaskOnKanban(null, movableTask), false);
});

test("duplicating a task is blocked for invoiced tasks and viewers", () => {
    const movableTask = task({ is_invoiced: false });
    const invoicedTask = task({ is_invoiced: true });

    assert.equal(canDuplicateTask(admin, movableTask), true);
    assert.equal(canDuplicateTask(manager, movableTask), true);
    assert.equal(canDuplicateTask(viewer, movableTask), false);
    assert.equal(canDuplicateTask(admin, invoicedTask), false);
    assert.equal(canDuplicateTask(manager, invoicedTask), false);
    assert.equal(canDuplicateTask(null, movableTask), false);
});

test("task list filters prevent viewers from querying another user", () => {
    assert.deepEqual(
        buildTaskListFilters({
            currentUser: admin,
            activeTab: "kanban",
            selectedLocationId: "",
            selectedStatus: "",
            selectedUserId: "",
        }),
        {},
    );

    assert.deepEqual(
        buildTaskListFilters({
            currentUser: manager,
            activeTab: "list",
            selectedLocationId: "50",
            selectedStatus: "completed",
            selectedUserId: viewer.id.toString(),
        }),
        { locationId: 50, status: "completed", userId: viewer.id },
    );

    assert.deepEqual(
        buildTaskListFilters({
            currentUser: manager,
            activeTab: "list",
            selectedLocationId: "",
            selectedStatus: "accepted",
            selectedUserId: "",
        }),
        { status: "accepted" },
    );

    assert.deepEqual(
        buildTaskListFilters({
            currentUser: viewer,
            activeTab: "list",
            selectedLocationId: "50",
            selectedStatus: "completed",
            selectedUserId: admin.id.toString(),
        }),
        { locationId: 50, status: "completed", userId: viewer.id },
    );
});

test("tasks page no longer exposes or restores the removed calendar tab", () => {
    assert.equal(parseTaskPageTab("kanban"), "kanban");
    assert.equal(parseTaskPageTab("list"), "list");
    assert.equal(parseTaskPageTab("templates"), "templates");
    assert.equal(parseTaskPageTab("calendar"), null);
});

test("admin-created all-worker task reaches admin, manager and viewers", () => {
    const description = buildChecklistDescription({
        description: "- [ ] Cocina\n- [ ] Baño",
        templateTaskId: 70,
        users: allCompanyUsers,
        selectedUserId: ALL_WORKERS_VALUE,
        fixedChecklistAssignments: {},
    });
    const createdTask = task({ description, user_id: null, status: "accepted" });

    for (const targetUser of allCompanyUsers) {
        assert.equal(isTaskAssignedToUser(createdTask, targetUser.id), true);
        assert.deepEqual(
            getUserChecklistItems(createdTask, targetUser.id).map(item => item.text),
            ["Cocina", "Baño"],
        );
        assert.equal(getUserTaskStatus(createdTask, targetUser.id), "accepted");
    }

    assert.equal(isTaskAssignedToUser(createdTask, 999), false);
    assert.deepEqual(getUserChecklistItems(createdTask, 999), []);
});

test("line-level assignments only reach their target user", () => {
    const description = buildChecklistDescription({
        description: "- [ ] Cocina\n- [ ] Baño\n- [ ] Terraza",
        templateTaskId: 80,
        users: allCompanyUsers,
        selectedUserId: "",
        fixedChecklistAssignments: {
            "80-0": admin.id.toString(),
            "80-1": manager.id.toString(),
            "80-2": viewer.id.toString(),
        },
    });
    const createdTask = task({ description, user_id: null, status: "pending" });

    assert.deepEqual(getUserChecklistItems(createdTask, admin.id).map(item => item.text), ["Cocina"]);
    assert.deepEqual(getUserChecklistItems(createdTask, manager.id).map(item => item.text), ["Baño"]);
    assert.deepEqual(getUserChecklistItems(createdTask, viewer.id).map(item => item.text), ["Terraza"]);
    assert.deepEqual(getUserChecklistItems(createdTask, secondViewer.id), []);

    assert.equal(isTaskAssignedToUser(createdTask, admin.id), true);
    assert.equal(isTaskAssignedToUser(createdTask, manager.id), true);
    assert.equal(isTaskAssignedToUser(createdTask, viewer.id), true);
    assert.equal(isTaskAssignedToUser(createdTask, secondViewer.id), false);
});

test("pending line assignment remains available to viewer dashboard kanban and calendar", () => {
    const victoriaTask = task({
        id: 101,
        description: "- [ ] Terraza (@3:Viewer User)",
        status: "pending",
        scheduled_start_at: "2026-07-13T12:00:00Z",
    });

    assert.equal(isTaskAssignedToUser(victoriaTask, viewer.id), true);
    assert.equal(getUserTaskStatus(victoriaTask, viewer.id), "pending");
    assert.equal(isOperationalStatus(victoriaTask.status), true);
    assert.equal(toKanbanStatus(victoriaTask.status), "pending");
    assert.deepEqual(
        getTasksForOverviewTab([victoriaTask], "todo").map(({ id }) => id),
        [101],
    );
    assert.equal(getTaskCalendarRange(victoriaTask)?.start.getDate(), 13);
});

test("work can start only after global approval and for the assigned worker", () => {
    assert.equal(canStartTaskWork("pending", "pending", true), false);
    assert.equal(canStartTaskWork("requested", "pending", true), false);
    assert.equal(canStartTaskWork("rejected", "pending", true), false);
    assert.equal(canStartTaskWork("accepted", "pending", true), true);
    assert.equal(canStartTaskWork("progress", "accepted", true), true);
    assert.equal(canStartTaskWork("review", "progress", true), true);
    assert.equal(canStartTaskWork("accepted", "completed", true), false);
    assert.equal(canStartTaskWork("accepted", "pending", false), false);
});

test("only active work states receive the in-progress visual treatment", () => {
    assert.equal(isTaskWorkInProgress("progress"), true);
    assert.equal(isTaskWorkInProgress("review"), true);
    assert.equal(isTaskWorkInProgress("in_progress"), true);
    assert.equal(isTaskWorkInProgress("pending"), false);
    assert.equal(isTaskWorkInProgress("accepted"), false);
    assert.equal(isTaskWorkInProgress("completed"), false);
});

test("direct task owner gets unassigned checklist work without stealing explicit assignments", () => {
    const createdTask = task({
        user_id: manager.id,
        description: "- [ ] General\n- [ ] Cocina (@3:Viewer User)",
        status: "progress",
    });

    assert.deepEqual(
        getUserChecklistItems(createdTask, manager.id).map(item => item.text),
        ["General"],
    );
    assert.deepEqual(
        getUserChecklistItems(createdTask, viewer.id).map(item => item.text),
        ["Cocina"],
    );
    assert.equal(getUserTaskStatus(createdTask, manager.id), "progress");
    assert.equal(getUserTaskStatus(createdTask, viewer.id), "pending");
});

test("worker status updates only mutate that worker checklist line", () => {
    const original = [
        "- [ ] Cocina (@2:Manager User)",
        "- [ ] Baño (@3:Viewer User)",
    ].join("\n");

    const result = setChecklistAssigneeStatus(original, viewer.id, "progress");
    const updatedTask = task({ description: result.description });

    assert.equal(result.updatedCount, 1);
    assert.match(result.description, /Baño \(@3:Viewer User:progress\)/);
    assert.match(result.description, /Cocina \(@2:Manager User\)/);
    assert.equal(getUserTaskStatus(updatedTask, viewer.id), "progress");
    assert.equal(getUserTaskStatus(updatedTask, manager.id), "pending");
});

test("frontend task visibility matches shared backend contract", () => {
    for (const contractCase of visibilityContract.cases) {
        const contractTask = task({ description: contractCase.description });
        for (const userId of contractCase.assignedUserIds) {
            assert.equal(
                isTaskAssignedToUser(contractTask, userId),
                true,
                `${contractCase.name}: user ${userId} should see task`,
            );
        }
        for (const userId of contractCase.unassignedUserIds) {
            assert.equal(
                isTaskAssignedToUser(contractTask, userId),
                false,
                `${contractCase.name}: user ${userId} should not see task`,
            );
        }
        for (const [userId, expectedItems] of Object.entries(contractCase.checklistByUser || {})) {
            assert.deepEqual(
                getUserChecklistItems(contractTask, Number(userId)).map(item => item.text),
                expectedItems,
                `${contractCase.name}: checklist mismatch for user ${userId}`,
            );
        }
    }
});

test("structured checklist wins over stale markdown metadata", () => {
    const structuredTask = task({
        description: "- [ ] Texto viejo (@999:Intruso:progress)",
        checklist_items: [
            {
                id: 501,
                position: 0,
                text: "Cocina estructurada",
                completed: false,
                assignments: [{ user_id: viewer.id, user_name: viewer.full_name || viewer.email, status: "accepted" }],
            },
        ],
        assignments: [
            { user_id: viewer.id, user_name: viewer.full_name || viewer.email, status: "accepted", source: "checklist" },
        ],
    });

    assert.deepEqual(parseTaskChecklistItems(structuredTask).map(item => item.text), ["Cocina estructurada"]);
    assert.equal(isTaskAssignedToUser(structuredTask, viewer.id), true);
    assert.equal(isTaskAssignedToUser(structuredTask, 999), false);
    assert.equal(getUserTaskStatus(structuredTask, viewer.id), "accepted");
});

test("legacy markdown remains readable during structured migration", () => {
    const legacyTask = task({
        description: `- [ ] Cocina (@${viewer.id}:Viewer User:pending)`,
    });

    assert.deepEqual(parseTaskChecklistItems(legacyTask).map(item => item.text), ["Cocina"]);
    assert.equal(isTaskAssignedToUser(legacyTask, viewer.id), true);
});

test("structured all-worker and direct assignments preserve checklist scope", () => {
    const checklistItems: NonNullable<TaskItem["checklist_items"]> = [
        { id: 601, position: 0, text: "General", completed: false, assignments: [] },
        {
            id: 602,
            position: 1,
            text: "Victoria",
            completed: false,
            assignments: [{
                user_id: viewer.id,
                user_name: viewer.full_name || viewer.email,
                status: "pending",
            }],
        },
    ];
    const structuredTask = task({
        description: "metadatos obsoletos",
        checklist_items: checklistItems,
        assignments: [
            {
                user_id: admin.id,
                user_name: admin.full_name || admin.email,
                status: "accepted",
                source: "all",
            },
            {
                user_id: manager.id,
                user_name: manager.full_name || manager.email,
                status: "accepted",
                source: "direct",
            },
            {
                user_id: viewer.id,
                user_name: viewer.full_name || viewer.email,
                status: "pending",
                source: "checklist",
            },
        ],
    });

    assert.deepEqual(getUserChecklistItems(structuredTask, admin.id).map(item => item.text), ["General", "Victoria"]);
    assert.deepEqual(getUserChecklistItems(structuredTask, manager.id).map(item => item.text), ["General"]);
    assert.deepEqual(getUserChecklistItems(structuredTask, viewer.id).map(item => item.text), ["Victoria"]);
    assert.equal(isTaskAssignedToUser(structuredTask, secondViewer.id), false);
});
