"use client";

import { Suspense, useMemo, useState } from "react";
import { Camera, CheckSquare, FileText, Search, ShieldAlert, Trash2 } from "lucide-react";

import { useTaskReportHistory } from "@/features/task-reports/useTaskReportHistory";
import { useTaskReportNavigation } from "@/features/task-reports/useTaskReportNavigation";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { TaskReportCard } from "@/features/task-reports/TaskReportCard";
import { TaskReportDetailDialog } from "@/features/task-reports/TaskReportDetailDialog";
import {
    clampPage,
    filterTaskReports,
    paginateItems,
    TASK_REPORT_PAGE_SIZE,
    totalPagesForCount,
    type TaskReportCategory,
} from "@/features/task-reports/task-report-center";
import {
    reportActionCluster,
} from "@/features/task-reports/task-report-action-styles";
import {
    areAllVisibleReportsSelected,
    toggleSelectedReportId,
    withVisibleReportsSelection,
} from "@/features/task-reports/task-report-selection";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { canManageWorkReports, canViewWorkReports } from "@/domain/access/roles";
import { TaskReportService, type TaskReportUpdate } from "@/services/task-report.service";

type ReportFilter = TaskReportCategory | "all";

const scrollHide =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export default function TaskReportsPage() {
    const { user, loading } = useUser();
    const context = JSON.stringify([user?.id, user?.company_id, user?.role?.name, canViewWorkReports(user), canManageWorkReports(user)]);
    return <Suspense><TaskReportsWorkspace key={context} context={context} userLoading={loading} /></Suspense>;
}

function TaskReportsWorkspace({ context, userLoading }: { context: string; userLoading: boolean }) {
    const { dict, locale } = useDictionary();
    const { user } = useUser();
    const copy = dict.task_reports;
    const canView = canViewWorkReports(user);
    const canManage = canManageWorkReports(user);
    const { reports, setReports, loading, error } = useTaskReportHistory(context, !userLoading && canView);
    const { selectedReport, setSelectedReport, linkUnavailable } = useTaskReportNavigation(reports, !loading && !error);
    const [query, setQuery] = useState("");
    const [type, setType] = useState<ReportFilter>("all");
    const [page, setPage] = useState(1);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [pendingDelete, setPendingDelete] = useState<"single" | "bulk" | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const filtered = useMemo(() => filterTaskReports(reports, { type, query }), [query, reports, type]);
    const totalPages = totalPagesForCount(filtered.length);
    const safePage = clampPage(page, totalPages);
    const pageItems = useMemo(
        () => paginateItems(filtered, safePage),
        [filtered, safePage],
    );
    const pageIds = useMemo(() => pageItems.map(report => report.id), [pageItems]);
    const labels = { issue: copy.issue, note: copy.note, photo: copy.photo };
    const allPageSelected = areAllVisibleReportsSelected(pageIds, selectedIds);
    const rangeFrom = filtered.length === 0 ? 0 : (safePage - 1) * TASK_REPORT_PAGE_SIZE + 1;
    const rangeTo = Math.min(safePage * TASK_REPORT_PAGE_SIZE, filtered.length);

    function exitSelectionMode() {
        setSelectionMode(false);
        setSelectedIds(new Set());
    }

    function changeType(next: ReportFilter) {
        setType(next);
        setPage(1);
    }

    function changeQuery(value: string) {
        setQuery(value);
        setPage(1);
    }

    async function handleSave(reportId: number, payload: TaskReportUpdate) {
        setSaving(true);
        setActionError(null);
        try {
            const updated = await TaskReportService.update(reportId, payload);
            setReports(current => current.map(report => (report.id === reportId ? updated : report)));
            setSelectedReport(updated);
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        setDeleting(true);
        setActionError(null);
        try {
            if (pendingDelete === "single" && selectedReport) {
                await TaskReportService.delete(selectedReport.id);
                setReports(current => current.filter(report => report.id !== selectedReport.id));
                setSelectedIds(current => {
                    const next = new Set(current);
                    next.delete(selectedReport.id);
                    return next;
                });
                setSelectedReport(null);
            } else if (pendingDelete === "bulk") {
                const ids = [...selectedIds];
                await TaskReportService.bulkDelete(ids);
                const removed = new Set(ids);
                setReports(current => current.filter(report => !removed.has(report.id)));
                if (selectedReport && removed.has(selectedReport.id)) setSelectedReport(null);
                exitSelectionMode();
            }
            setPendingDelete(null);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : copy.error_delete);
            setPendingDelete(null);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className={`dashboard-page-content px-[3%] py-5 md:px-7 md:py-6 ${scrollHide}`}>
            <div className="mx-auto w-full max-w-6xl space-y-4">
                <PageHeader
                    icon={ShieldAlert}
                    title={copy.title}
                    subtitle={copy.subtitle}
                    actions={(
                        canManage && selectionMode ? (
                            <div className={reportActionCluster}>
                                <Button
                                    type="button"
                                    variant={allPageSelected ? "default" : "select"}
                                    size="xs"
                                    className="h-8 px-3.5 text-[9px] font-black uppercase tracking-wider"
                                    onClick={() => setSelectedIds(withVisibleReportsSelection(selectedIds, pageIds, !allPageSelected))}
                                >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {copy.select_all_visible}
                                </Button>
                                <Button
                                    type="button"
                                    variant="cancel"
                                    size="xs"
                                    className="h-8 px-3.5 text-[9px] font-black uppercase tracking-wider"
                                    onClick={exitSelectionMode}
                                >
                                    {copy.cancel_selection}
                                </Button>
                                <Button
                                    type="button"
                                    variant="dangerSoft"
                                    size="xs"
                                    disabled={selectedIds.size === 0}
                                    className="h-8 px-3.5 text-[9px] font-black uppercase tracking-wider"
                                    onClick={() => setPendingDelete("bulk")}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {copy.delete_selected}
                                </Button>
                            </div>
                        ) : canManage ? (
                            <Button
                                type="button"
                                size="xs"
                                className="h-8 px-3.5 text-[9px] font-black uppercase tracking-wider"
                                onClick={() => setSelectionMode(true)}
                            >
                                <CheckSquare className="h-3.5 w-3.5" />
                                {copy.select}
                            </Button>
                        ) : null
                    )}
                />

                {!userLoading && !canView && (
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 text-center text-sm text-[var(--text-muted)]">
                        No tienes permisos para consultar los partes de trabajo.
                    </div>
                )}

                {canView && selectionMode && selectedIds.size > 0 && (
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {copy.selected_count.replace("{count}", String(selectedIds.size))}
                    </p>
                )}

                {canView && actionError && (
                    <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-sm text-[var(--btn-cancel-text)]">
                        {actionError}
                    </div>
                )}

                {canView && <section className="space-y-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2.5 shadow-sm sm:p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        <Input
                            value={query}
                            onChange={event => changeQuery(event.target.value)}
                            placeholder={copy.search}
                            className="h-9 rounded-xl border-[var(--border-soft)] bg-[var(--bg-secondary)] pl-9 text-sm"
                        />
                    </div>
                    <PremiumTabs<ReportFilter>
                        layout="fit"
                        tabs={[
                            { id: "all", label: copy.all },
                            { id: "issue", label: copy.issue, icon: ShieldAlert },
                            { id: "note", label: copy.note, icon: FileText },
                            { id: "photo", label: copy.photo, icon: Camera },
                        ]}
                        activeTab={type}
                        onChange={changeType}
                    />
                </section>}

                {canView && loading && <p className="py-14 text-center text-sm text-[var(--text-muted)]">{copy.loading}</p>}
                {canView && !loading && (error || linkUnavailable) && (
                    <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 text-sm text-[var(--btn-cancel-text)]">
                        {linkUnavailable ? copy.unavailable : copy.error}
                    </div>
                )}
                {canView && !loading && !error && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                        {copy.empty}
                    </div>
                )}

                {canView && <section className="grid items-start gap-2 xl:grid-cols-2">
                    {pageItems.map(report => (
                        <TaskReportCard
                            key={report.id}
                            report={report}
                            locale={locale}
                            labels={labels}
                            selectionMode={selectionMode}
                            selected={selectedIds.has(report.id)}
                            onToggleSelect={reportId => setSelectedIds(current => toggleSelectedReportId(current, reportId))}
                            onOpen={setSelectedReport}
                        />
                    ))}
                </section>}

                {canView && !loading && !error && filtered.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-4 text-xs font-semibold text-[var(--text-muted)] sm:flex-row">
                        <p>
                            {copy.pagination_info
                                .replace("{from}", String(rangeFrom))
                                .replace("{to}", String(rangeTo))
                                .replace("{total}", String(filtered.length))}
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                disabled={safePage === 1}
                                onClick={() => setPage(current => Math.max(current - 1, 1))}
                                className="px-3 py-1.5 font-bold"
                            >
                                {copy.prev_page}
                            </Button>
                            <span className="px-2 font-black text-[var(--text-main)]">
                                {safePage}/{totalPages}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                disabled={safePage === totalPages}
                                onClick={() => setPage(current => Math.min(current + 1, totalPages))}
                                className="px-3 py-1.5 font-bold"
                            >
                                {copy.next_page}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <TaskReportDetailDialog
                report={selectedReport}
                locale={locale}
                labels={labels}
                copy={copy}
                saving={saving}
                canManage={canManage}
                onClose={() => setSelectedReport(null)}
                onSave={handleSave}
                onDelete={() => setPendingDelete("single")}
            />

            <DeleteConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={open => { if (!open) setPendingDelete(null); }}
                title={pendingDelete === "bulk" ? copy.confirm_bulk_delete_title : copy.confirm_delete_title}
                description={
                    pendingDelete === "bulk"
                        ? copy.confirm_bulk_delete_description.replace("{count}", String(selectedIds.size))
                        : copy.confirm_delete_description
                }
                onConfirm={() => { void confirmDelete(); }}
                isDeleting={deleting}
                confirmText={copy.delete}
                cancelText={copy.cancel}
            />
        </div>
    );
}
