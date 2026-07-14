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
                className="group flex w-full items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5 text-left transition hover:border-accent/35 hover:bg-[var(--bg-secondary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] font-bold text-[var(--text-main)]">{heading}</span>
                        <Badge variant="secondary" className="shrink-0 text-[9px] font-black uppercase tracking-wide">
                            {labels[category]}
                        </Badge>
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-accent" />
                            <span className="truncate">{report.location_name}</span>
                        </span>
                        <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <UserRound className="h-3 w-3 shrink-0" />
                            <span className="truncate">{report.reporter_name}</span>
                        </span>
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <time className="text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(report.created_at))}
                    </time>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </span>
            </button>
        </article>
    );
}
