import Image from "next/image";
import { Building2, CalendarClock, FileText, MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTaskReportCategory, getTaskReportMediaHref } from "@/features/task-reports/task-report-center";
import type { TaskReport } from "@/services/task-report.service";

type Props = {
    report: TaskReport | null;
    locale: string;
    labels: Record<"issue" | "note" | "photo", string>;
    copy: Record<string, string>;
    onClose: () => void;
};

export function TaskReportDetailDialog({ report, locale, labels, copy, onClose }: Props) {
    const mediaHref = report ? getTaskReportMediaHref(report.media_url) : null;
    const category = report ? getTaskReportCategory(report.report_type) : "note";

    return (
        <Dialog open={Boolean(report)} onOpenChange={open => { if (!open) onClose(); }}>
            {report && (
                <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
                    <DialogHeader className="border-b border-[var(--border-soft)] px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pt-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-wide">{labels[category]}</Badge>
                            <time className="text-xs text-[var(--text-muted)]">
                                {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}
                            </time>
                        </div>
                        <DialogTitle>{report.title || report.checklist_item_label || report.task_title}</DialogTitle>
                        <DialogDescription>{copy.detail_subtitle}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
                        {mediaHref && (
                            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]">
                                <Image src={mediaHref} alt={report.title || report.checklist_item_label || copy.view_photo} fill unoptimized className="object-contain" />
                            </div>
                        )}
                        {report.description && (
                            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">{report.description}</p>
                            </div>
                        )}
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                            <Detail icon={MapPin} label={report.location_name} />
                            <Detail icon={FileText} label={`${copy.task}: ${report.task_title}`} />
                            <Detail icon={UserRound} label={`${copy.reported_by}: ${report.reporter_name}`} />
                            <Detail icon={Building2} label={report.reporter_company_name} />
                            <Detail icon={CalendarClock} label={new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(new Date(report.created_at))} />
                            {report.requesting_company_name && (
                                <Detail icon={Building2} label={`${copy.collaboration}: ${report.reporter_company_name} → ${report.requesting_company_name}`} />
                            )}
                        </dl>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}

function Detail({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
    return (
        <div className="flex min-w-0 items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-[var(--text-muted)]">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <dd className="min-w-0 break-words">{label}</dd>
        </div>
    );
}
