import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("task report service exposes update delete and bulk-delete mutations", () => {
    const service = read("../services/task-report.service.ts");
    assert.match(service, /update:\s*async/);
    assert.match(service, /method:\s*"PATCH"/);
    assert.match(service, /delete:\s*async/);
    assert.match(service, /method:\s*"DELETE"/);
    assert.match(service, /bulkDelete:\s*async/);
    assert.match(service, /\/api\/v1\/task-reports\/bulk-delete/);
    assert.match(service, /assertApiResponseOk|extractErrorMessage/);
});

test("report center page supports selection bulk delete and detail edit delete", () => {
    const page = read("../app/dashboard/task-reports/page.tsx");
    const card = read("../features/task-reports/TaskReportCard.tsx");
    const dialog = read("../features/task-reports/TaskReportDetailDialog.tsx");
    const selection = read("../features/task-reports/task-report-selection.ts");
    const styles = read("../features/task-reports/task-report-action-styles.ts");

    assert.match(selection, /toggleSelectedReportId/);
    assert.match(selection, /withVisibleReportsSelection/);
    assert.match(styles, /reportActionCluster|bg-\[var\(--bg-primary\)\]\/40/);
    assert.match(page, /TaskReportService\.bulkDelete/);
    assert.match(page, /DeleteConfirmDialog/);
    assert.match(page, /selectedIds|selectedReportIds/);
    assert.match(page, /reportActionCluster/);
    assert.match(page, /components\/ui\/button/);
    assert.match(dialog, /components\/ui\/button/);
    assert.doesNotMatch(page, /<button\b/);
    assert.doesNotMatch(dialog, /<button\b/);
    assert.match(card, /selected|onToggleSelect|checkbox/i);
    assert.match(dialog, /TaskReportService\.update|onSave|onEdit/i);
    assert.match(dialog, /onDelete|TaskReportService\.delete/i);
});

test("report center copy no longer claims immutable history", () => {
    const es = read("../dictionaries/es.json");
    const en = read("../dictionaries/en.json");
    assert.doesNotMatch(es, /Historial inmutable/);
    assert.doesNotMatch(en, /Immutable history/);
    assert.doesNotMatch(es, /no puede editarse ni borrarse/);
    assert.doesNotMatch(en, /cannot be edited or deleted/);
});

test("tech task create hooks still do not own report deletion", () => {
    const issueHook = read("../components/dashboard/tech-task/hooks/useTechTaskIssues.ts");
    const attachmentsHook = read(
        "../components/dashboard/tech-task/hooks/useTechTaskAttachmentsComments.ts",
    );
    assert.doesNotMatch(issueHook, /handleDeleteIssue|reportedIssues/);
    assert.doesNotMatch(attachmentsHook, /handleDeleteAttachment|handleDeleteComment/);
});
