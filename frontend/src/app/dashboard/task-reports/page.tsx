"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Camera, CheckSquare, FileText, Search, ShieldAlert, Trash2 } from "lucide-react";

import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/dashboard/notifications/notification-utils";
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
    reportDangerBtn,
    reportNeutralBtn,
    reportPrimaryBtn,
    reportSoftAccentBtn,
} from "@/features/task-reports/task-report-action-styles";
import {
    areAllVisibleReportsSelected,
    toggleSelectedReportId,
    withVisibleReportsSelection,
} from "@/features/task-reports/task-report-selection";
import { useDictionary } from "@/lib/dictionary-context";
import { TaskReportService, type TaskReport, type TaskReportUpdate } from "@/services/task-report.service";

type ReportFilter = TaskReportCategory | "all";

const scrollHide =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export default function TaskReportsPage() {
    const { dict, locale } = useDictionary();
    const copy = dict.task_reports;
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [query, setQuery] = useState("");
    const [type, setType] = useState<ReportFilter>("all");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedReport, setSelectedReport] = useState<TaskReport | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [pendingDelete, setPendingDelete] = useState<"single" | "bulk" | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const loadReports = useEffectEvent(async () => {
        setError(false);
        try {
            const history = await TaskReportService.list();
            setReports(history);
            try {
                await TaskReportService.markNotificationsRead();
                window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
            } catch {
                // History remains usable; next visit can retry alert acknowledgement.
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    });

    useEffect(() => {
        startTransition(() => { void loadReports(); });
    }, []);

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
        <div className={`h-full overflow-y-auto px-[3%] py-5 md:px-7 md:py-6 ${scrollHide}`}>
            <div className="mx-auto w-full max-w-6xl space-y-4">
                <PageHeader
                    icon={ShieldAlert}
                    title={copy.title}
                    subtitle={copy.subtitle}
                    actions={(
                        selectionMode ? (
                            <div className={reportActionCluster}>
                                <button
                                    type="button"
                                    className={allPageSelected ? reportPrimaryBtn : reportSoftAccentBtn}
                                    onClick={() => setSelectedIds(withVisibleReportsSelection(selectedIds, pageIds, !allPageSelected))}
                                >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {copy.select_all_visible}
                                </button>
                                <button
                                    type="button"
                                    className={reportNeutralBtn}
                                    onClick={exitSelectionMode}
                                >
                                    {copy.cancel_selection}
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedIds.size === 0}
                                    className={reportDangerBtn}
                                    onClick={() => setPendingDelete("bulk")}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {copy.delete_selected}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className={reportPrimaryBtn}
                                onClick={() => setSelectionMode(true)}
                            >
                                <CheckSquare className="h-3.5 w-3.5" />
                                {copy.select}
                            </button>
                        )
                    )}
                />

                {selectionMode && selectedIds.size > 0 && (
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {copy.selected_count.replace("{count}", String(selectedIds.size))}
                    </p>
                )}

                {actionError && (
                    <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-sm text-[var(--btn-cancel-text)]">
                        {actionError}
                    </div>
                )}

                <section className="space-y-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2.5 shadow-sm sm:p-3">
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
                </section>

                {loading && <p className="py-14 text-center text-sm text-[var(--text-muted)]">{copy.loading}</p>}
                {!loading && error && (
                    <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 text-sm text-[var(--btn-cancel-text)]">
                        {copy.error}
                    </div>
                )}
                {!loading && !error && filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                        {copy.empty}
                    </div>
                )}

                <section className="grid items-start gap-2 md:grid-cols-2">
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
                </section>

                {!loading && !error && filtered.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-4 text-xs font-semibold text-[var(--text-muted)] sm:flex-row">
                        <p>
                            {copy.pagination_info
                                .replace("{from}", String(rangeFrom))
                                .replace("{to}", String(rangeTo))
                                .replace("{total}", String(filtered.length))}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={safePage === 1}
                                onClick={() => setPage(current => Math.max(current - 1, 1))}
                                className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 font-bold transition-all hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {copy.prev_page}
                            </button>
                            <span className="px-2 font-black text-[var(--text-main)]">
                                {safePage}/{totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={safePage === totalPages}
                                onClick={() => setPage(current => Math.min(current + 1, totalPages))}
                                className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 font-bold transition-all hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {copy.next_page}
                            </button>
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
