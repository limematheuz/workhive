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
    const page = read("../features/task-reports/useTaskReportHistory.ts");
    assert.match(page, /TaskReportService\.list/);
    assert.match(page, /TaskReportService\.markNotificationsRead/);
    assert.match(page, /TaskReportService\.list[\s\S]+\.then\(history =>[\s\S]+if \(!current\) return;[\s\S]+TaskReportService\.markNotificationsRead/);
});

test("report center reuses the application visual system and keeps details in a dialog", () => {
    const page = read("../app/dashboard/task-reports/page.tsx");
    const reportCard = read("../features/task-reports/TaskReportCard.tsx");
    const reportDialog = read("../features/task-reports/TaskReportDetailDialog.tsx");
    const premiumTabs = read("../components/ui/premium-tabs.tsx") + read("../components/ui/premium-tab-label.tsx");

    assert.match(page, /PremiumTabs/);
    assert.match(page, /layout="fit"/);
    assert.match(page, /paginateItems|TASK_REPORT_PAGE_SIZE/);
    assert.match(page, /components\/ui\/input/);
    assert.match(page, /components\/ui\/button/);
    assert.match(page, /scrollbar-width:none/);
    assert.match(premiumTabs, /layout\?:\s*"scroll"\s*\|\s*"fit"/);
    assert.match(premiumTabs, /useAdaptiveTabs/);
    assert.match(premiumTabs, /bg-\[var\(--bg-primary\)\]\/40/);
    assert.doesNotMatch(premiumTabs, /dialog-control-bg/);
    assert.doesNotMatch(premiumTabs, /text-\[10px\].*uppercase tracking-wider/);
    assert.match(premiumTabs, /h-3\.5 w-3\.5/);
    assert.match(premiumTabs, /overflow-hidden/);
    assert.match(reportCard, /components\/ui\/badge/);
    assert.match(reportCard, /components\/ui\/checkbox/);
    assert.match(reportDialog, /components\/ui\/button/);
    assert.match(reportDialog, /components\/ui\/textarea/);
    assert.doesNotMatch(reportCard, /<input\b/);
    assert.doesNotMatch(reportDialog, /<textarea\b/);
    assert.doesNotMatch(page, /<button\b/);
    assert.doesNotMatch(reportDialog, /<button\b/);
    assert.match(reportDialog, /components\/ui\/dialog/);
    assert.match(reportDialog, /h-36/);
    assert.match(reportDialog, /scrollbar-width:none/);
    assert.doesNotMatch(page, /aspect-\[16\/10\]|xl:grid-cols-3/);
    assert.doesNotMatch(reportDialog, /aspect-\[16\/9\]/);
});

test("report center has role-scoped navigation and its own alert count", () => {
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const navigation = read("../components/dashboard/SidebarNavigation.tsx");
    const config = read("../components/dashboard/sidebar-nav-config.tsx");
    assert.match(config, /\/dashboard\/task-reports/);
    assert.match(config, /isAdminOrManager/);
    const reportCount = read("../components/dashboard/notifications/useNotificationReportCount.ts");
    assert.match(sidebar, /useNotificationReportCount/);
    assert.match(reportCount, /countUnreadTaskReportNotifications/);
    assert.match(navigation, /reportAlertsCount/);
});
