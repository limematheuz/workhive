import assert from "node:assert/strict";
import test from "node:test";

import {
    clampPage,
    filterTaskReports,
    getTaskReportMediaHref,
    paginateItems,
    sortTaskReportsNewestFirst,
    totalPagesForCount,
    type TaskReportSummary,
} from "../features/task-reports/task-report-center.ts";

const reports: TaskReportSummary[] = [
    {
        id: 1,
        report_type: "note",
        title: null,
        description: "Cristal roto en el salón",
        reporter_name: "Victoria",
        reporter_company_name: "Limpiezas Uno",
        requesting_company_name: "Inmobiliaria Norte",
        task_title: "Limpieza completa",
        location_name: "Casa Javier",
        media_url: null,
        created_at: "2026-07-14T08:00:00Z",
    },
    {
        id: 2,
        report_type: "photo",
        title: null,
        description: null,
        reporter_name: "Andrea",
        reporter_company_name: "Limpiezas Uno",
        requesting_company_name: null,
        task_title: "Revisión",
        location_name: "Piso Centro",
        media_url: "/api/v1/task-reports/2/media",
        created_at: "2026-07-14T09:00:00Z",
    },
    {
        id: 3,
        report_type: "checklist_photo",
        title: null,
        description: null,
        reporter_name: "Victoria",
        reporter_company_name: "Limpiezas Uno",
        requesting_company_name: null,
        task_title: "Limpieza completa",
        location_name: "Casa Javier",
        media_url: "/api/v1/task-reports/3/media",
        created_at: "2026-07-14T10:00:00Z",
    },
];

test("report center sorts newest first without mutating API data", () => {
    const sorted = sortTaskReportsNewestFirst(reports);
    assert.deepEqual(sorted.map(report => report.id), [3, 2, 1]);
    assert.deepEqual(reports.map(report => report.id), [1, 2, 3]);
});

test("report center filters by type and all visible operational fields", () => {
    assert.deepEqual(filterTaskReports(reports, { type: "photo", query: "" }).map(item => item.id), [3, 2]);
    assert.deepEqual(filterTaskReports(reports, { type: "all", query: "victoria cristal" }).map(item => item.id), [1]);
    assert.deepEqual(filterTaskReports(reports, { type: "all", query: "casa javier" }).map(item => item.id), [3, 1]);
    assert.deepEqual(filterTaskReports(reports, { type: "all", query: "inmobiliaria norte" }).map(item => item.id), [1]);
});

test("report media href accepts only same-origin task report routes", () => {
    assert.equal(getTaskReportMediaHref("/api/v1/task-reports/2/media"), "/api/v1/task-reports/2/media");
    assert.equal(getTaskReportMediaHref("https://attacker.example/image.png"), null);
    assert.equal(getTaskReportMediaHref("//attacker.example/image.png"), null);
    assert.equal(getTaskReportMediaHref("/api/v1/uploads/media/company/2/private.png"), null);
});

test("report center paginates filtered results and clamps out-of-range pages", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
        ...reports[0],
        id: index + 1,
        created_at: `2026-07-14T${String(index).padStart(2, "0")}:00:00Z`,
    }));
    assert.equal(totalPagesForCount(many.length, 12), 3);
    assert.deepEqual(paginateItems(many, 1, 12).map(item => item.id), many.slice(0, 12).map(item => item.id));
    assert.deepEqual(paginateItems(many, 3, 12).map(item => item.id), many.slice(24).map(item => item.id));
    assert.deepEqual(paginateItems(many, 99, 12).map(item => item.id), many.slice(24).map(item => item.id));
    assert.equal(clampPage(0, 3), 1);
    assert.equal(clampPage(9, 3), 3);
    assert.equal(totalPagesForCount(0), 1);
});

