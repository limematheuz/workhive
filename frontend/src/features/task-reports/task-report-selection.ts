import type { TaskReport } from "@/services/task-report.service";

export function toggleSelectedReportId(
    selected: ReadonlySet<number>,
    reportId: number,
): Set<number> {
    const next = new Set(selected);
    if (next.has(reportId)) next.delete(reportId);
    else next.add(reportId);
    return next;
}

export function withVisibleReportsSelection(
    selected: ReadonlySet<number>,
    visibleIds: readonly number[],
    selectVisible: boolean,
): Set<number> {
    const next = new Set(selected);
    for (const id of visibleIds) {
        if (selectVisible) next.add(id);
        else next.delete(id);
    }
    return next;
}

export function areAllVisibleReportsSelected(
    visibleIds: readonly number[],
    selected: ReadonlySet<number>,
): boolean {
    return visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
}

export function canEditTaskReportContent(reportType: TaskReport["report_type"]): boolean {
    return reportType === "issue" || reportType === "note" || reportType === "checklist_note";
}
