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

                        {report.description && (
                            <p className="whitespace-pre-wrap rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-main)]">
                                {report.description}
                            </p>
                        )}

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
                    </div>
                </DialogContent>
            )}
        </Dialog>
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
