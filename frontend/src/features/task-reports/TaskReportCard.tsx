import { Camera, ChevronRight, FileText, MapPin, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getTaskReportCategory } from "@/features/task-reports/task-report-center";
import type { TaskReport } from "@/services/task-report.service";

type Props = {
    report: TaskReport;
    locale: string;
    labels: Record<"issue" | "note" | "photo", string>;
    onOpen: (report: TaskReport) => void;
};

const icons = { issue: ShieldAlert, note: FileText, photo: Camera };

export function TaskReportCard({ report, locale, labels, onOpen }: Props) {
    const category = getTaskReportCategory(report.report_type);
    const Icon = icons[category];
    const heading = report.title || report.checklist_item_label || report.task_title;

    return (
        <article className="min-w-0">
            <button
                type="button"
                onClick={() => onOpen(report)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:p-4"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-accent">
                    <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-black text-[var(--text-main)] sm:text-[15px]">{heading}</span>
                        <Badge variant="secondary" className="hidden text-[9px] font-black uppercase tracking-wide sm:inline-flex">
                            {labels[category]}
                        </Badge>
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                            <span className="truncate">{report.location_name}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <UserRound className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{report.reporter_name}</span>
                        </span>
                    </span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                    <time className="block text-[11px] font-semibold text-[var(--text-muted)]">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(report.created_at))}
                    </time>
                    <span className="mt-1 inline-flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-wide text-accent opacity-0 transition group-hover:opacity-100">
                        {labels[category]} <ChevronRight className="h-3 w-3" />
                    </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] sm:hidden" />
            </button>
        </article>
    );
}
