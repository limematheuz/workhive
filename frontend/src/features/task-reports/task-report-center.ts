import type { TaskReport } from "@/services/task-report.service";


export type TaskReportSummary = Pick<
    TaskReport,
    | "id"
    | "report_type"
    | "title"
    | "description"
    | "reporter_name"
    | "reporter_company_name"
    | "requesting_company_name"
    | "task_title"
    | "location_name"
    | "media_url"
    | "created_at"
>;

type TaskReportFilters = {
    type: TaskReportCategory | "all";
    query: string;
};

export type TaskReportCategory = "issue" | "note" | "photo";

export function getTaskReportCategory(reportType: TaskReport["report_type"]): TaskReportCategory {
    if (reportType === "checklist_note") return "note";
    if (reportType === "checklist_photo") return "photo";
    return reportType;
}

export function sortTaskReportsNewestFirst<T extends TaskReportSummary>(reports: readonly T[]): T[] {
    return [...reports].sort((left, right) => {
        const byDate = Date.parse(right.created_at) - Date.parse(left.created_at);
        return byDate || right.id - left.id;
    });
}

export function filterTaskReports<T extends TaskReportSummary>(
    reports: readonly T[],
    filters: TaskReportFilters,
): T[] {
    const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return sortTaskReportsNewestFirst(reports).filter(report => {
        if (filters.type !== "all" && getTaskReportCategory(report.report_type) !== filters.type) return false;
        const searchable = [
            report.title,
            report.description,
            report.reporter_name,
            report.reporter_company_name,
            report.requesting_company_name,
            report.task_title,
            report.location_name,
        ].filter(Boolean).join(" ").toLocaleLowerCase();
        return terms.every(term => searchable.includes(term));
    });
}

export function getTaskReportMediaHref(mediaUrl: string | null): string | null {
    if (!mediaUrl || !/^\/api\/v1\/task-reports\/\d+\/media$/.test(mediaUrl)) return null;
    return mediaUrl;
}
