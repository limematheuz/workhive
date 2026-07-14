"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2, CalendarClock, FileText, MapPin, Pencil, Trash2, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getTaskReportCategory, getTaskReportMediaHref } from "@/features/task-reports/task-report-center";
import {
    reportActionCluster,
    reportDangerBtn,
    reportNeutralBtn,
    reportPrimaryBtn,
    reportSoftAccentBtn,
} from "@/features/task-reports/task-report-action-styles";
import { canEditTaskReportContent } from "@/features/task-reports/task-report-selection";
import type { TaskReport, TaskReportUpdate } from "@/services/task-report.service";

type Props = {
    report: TaskReport | null;
    locale: string;
    labels: Record<"issue" | "note" | "photo", string>;
    copy: Record<string, string>;
    saving: boolean;
    onClose: () => void;
    onSave: (reportId: number, payload: TaskReportUpdate) => Promise<void>;
    onDelete: (report: TaskReport) => void;
};

export function TaskReportDetailDialog({
    report,
    locale,
    labels,
    copy,
    saving,
    onClose,
    onSave,
    onDelete,
}: Props) {
    const [editingReportId, setEditingReportId] = useState<number | null>(null);
    const editing = report !== null && editingReportId === report.id;
    const mediaHref = report ? getTaskReportMediaHref(report.media_url) : null;
    const category = report ? getTaskReportCategory(report.report_type) : "note";
    const editable = report ? canEditTaskReportContent(report.report_type) : false;

    return (
        <Dialog
            open={Boolean(report)}
            onOpenChange={open => {
                if (!open) {
                    setEditingReportId(null);
                    onClose();
                }
            }}
        >
            {report && (
                <DialogContent className="max-h-[min(88vh,720px)] gap-0 overflow-y-auto p-0 sm:max-w-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <DialogHeader className="space-y-2 border-b border-[var(--border-soft)] px-5 py-4 pr-16 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-wide">
                                {labels[category]}
                            </Badge>
                            <time className="text-[11px] font-semibold text-[var(--text-muted)]">
                                {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}
                            </time>
                        </div>
                        <DialogTitle className="text-lg leading-snug">
                            {report.title || report.checklist_item_label || report.task_title}
                        </DialogTitle>
                        <DialogDescription className="text-xs">{copy.detail_subtitle}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 px-5 py-4 sm:px-5">
                        {mediaHref && (
                            <a
                                href={mediaHref}
                                target="_blank"
                                rel="noreferrer"
                                className="relative mx-auto block h-36 w-full max-w-xs overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] transition hover:border-accent/40"
                            >
                                <Image
                                    src={mediaHref}
                                    alt={report.title || report.checklist_item_label || copy.view_photo}
                                    fill
                                    unoptimized
                                    className="object-contain p-2"
                                />
                            </a>
                        )}

                        {editing ? (
                            <ReportEditForm
                                key={report.id}
                                report={report}
                                copy={copy}
                                saving={saving}
                                onCancel={() => setEditingReportId(null)}
                                onSave={async payload => {
                                    await onSave(report.id, payload);
                                    setEditingReportId(null);
                                }}
                            />
                        ) : (
                            report.description && (
                                <p className="whitespace-pre-wrap rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-main)]">
                                    {report.description}
                                </p>
                            )
                        )}

                        {!editing && (
                            <dl className="divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-sm">
                                <Detail icon={MapPin} label={report.location_name} />
                                <Detail icon={FileText} label={`${copy.task}: ${report.task_title}`} />
                                <Detail icon={UserRound} label={`${copy.reported_by}: ${report.reporter_name}`} />
                                <Detail icon={Building2} label={report.reporter_company_name} />
                                <Detail
                                    icon={CalendarClock}
                                    label={new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(new Date(report.created_at))}
                                />
                                {report.requesting_company_name && (
                                    <Detail
                                        icon={Building2}
                                        label={`${copy.collaboration}: ${report.reporter_company_name} → ${report.requesting_company_name}`}
                                    />
                                )}
                            </dl>
                        )}

                        {!editable && !editing && (
                            <p className="text-xs text-[var(--text-muted)]">{copy.photos_not_editable}</p>
                        )}

                        {!editing && (
                            <div className={`${reportActionCluster} w-full sm:w-auto`}>
                                {editable && (
                                    <button
                                        type="button"
                                        onClick={() => setEditingReportId(report.id)}
                                        className={reportSoftAccentBtn}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        {copy.edit}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onDelete(report)}
                                    className={reportDangerBtn}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {copy.delete}
                                </button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}

function ReportEditForm({
    report,
    copy,
    saving,
    onCancel,
    onSave,
}: {
    report: TaskReport;
    copy: Record<string, string>;
    saving: boolean;
    onCancel: () => void;
    onSave: (payload: TaskReportUpdate) => Promise<void>;
}) {
    const [title, setTitle] = useState(report.title || "");
    const [description, setDescription] = useState(report.description || "");
    const [issueType, setIssueType] = useState(report.issue_type || "");
    const [element, setElement] = useState(report.element || "");
    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
        setError(null);
        try {
            if (report.report_type === "issue") {
                await onSave({
                    title: title.trim(),
                    description: description.trim() || null,
                    issue_type: issueType.trim() || null,
                    element: element.trim() || null,
                });
            } else {
                await onSave({ description: description.trim() });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : copy.error_update);
        }
    }

    return (
        <div className="space-y-3">
            {report.report_type === "issue" && (
                <>
                    <label className="block space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            {copy.title_label}
                        </span>
                        <Input value={title} onChange={event => setTitle(event.target.value)} className="h-9 rounded-xl" />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                {copy.issue_type_label}
                            </span>
                            <Input value={issueType} onChange={event => setIssueType(event.target.value)} className="h-9 rounded-xl" />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                {copy.element_label}
                            </span>
                            <Input value={element} onChange={event => setElement(event.target.value)} className="h-9 rounded-xl" />
                        </label>
                    </div>
                </>
            )}
            <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {copy.description_label}
                </span>
                <textarea
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
            </label>
            {error && <p className="text-sm text-[var(--btn-cancel-text)]">{error}</p>}
            <div className={`${reportActionCluster} w-full sm:w-auto`}>
                <button type="button" disabled={saving} onClick={onCancel} className={reportNeutralBtn}>
                    {copy.cancel}
                </button>
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => { void handleSave(); }}
                    className={reportPrimaryBtn}
                >
                    {copy.save}
                </button>
            </div>
        </div>
    );
}

function Detail({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
    return (
        <div className="flex min-w-0 items-start gap-2.5 px-3 py-2.5 text-[var(--text-muted)]">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <dd className="min-w-0 break-words leading-snug">{label}</dd>
        </div>
    );
}
