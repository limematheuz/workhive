import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("task report UI uses its dedicated service instead of mutating task history arrays", () => {
    const issueHook = read("../components/dashboard/tech-task/hooks/useTechTaskIssues.ts");
    const attachmentsHook = read("../components/dashboard/tech-task/hooks/useTechTaskAttachmentsComments.ts");
    const checklistHook = read("../components/dashboard/tech-task/hooks/useTechTaskChecklist.ts");
    const service = read("../services/task-report.service.ts");

    assert.match(service, /\/api\/v1\/task-reports\//);
    assert.match(issueHook, /TaskReportService\.create/);
    assert.doesNotMatch(issueHook, /reported_issues:/);
    assert.match(attachmentsHook, /TaskReportService\.create/);
    assert.doesNotMatch(attachmentsHook, /TaskService\.updateTaskItem/);
    assert.match(checklistHook, /TaskReportService\.createChecklistNote/);
    assert.match(checklistHook, /TaskReportService\.createChecklistPhoto/);
    assert.doesNotMatch(issueHook, /handleDeleteIssue|reportedIssues/);
    assert.doesNotMatch(attachmentsHook, /handleDeleteAttachment|handleDeleteComment/);
});

test("report center marks report notifications read only after loading history", () => {
    const page = read("../app/dashboard/task-reports/page.tsx");
    assert.match(page, /TaskReportService\.list/);
    assert.match(page, /TaskReportService\.markNotificationsRead/);
    assert.match(page, /await TaskReportService\.list[\s\S]+await TaskReportService\.markNotificationsRead/);
});

test("report center has role-scoped navigation and its own alert count", () => {
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const navigation = read("../components/dashboard/SidebarNavigation.tsx");
    const config = read("../components/dashboard/sidebar-nav-config.tsx");
    assert.match(config, /\/dashboard\/task-reports/);
    assert.match(config, /isAdminOrManager/);
    assert.match(sidebar, /countUnreadTaskReportNotifications/);
    assert.match(navigation, /reportAlertsCount/);
});
