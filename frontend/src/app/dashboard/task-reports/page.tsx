"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Camera, FileText, Search, ShieldAlert } from "lucide-react";

import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/dashboard/notifications/notification-utils";
import { Input } from "@/components/ui/input";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { TaskReportCard } from "@/features/task-reports/TaskReportCard";
import { TaskReportDetailDialog } from "@/features/task-reports/TaskReportDetailDialog";
import { filterTaskReports, type TaskReportCategory } from "@/features/task-reports/task-report-center";
import { useDictionary } from "@/lib/dictionary-context";
import { TaskReportService, type TaskReport } from "@/services/task-report.service";

type ReportFilter = TaskReportCategory | "all";

const scrollHide =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export default function TaskReportsPage() {
    const { dict, locale } = useDictionary();
    const copy = dict.task_reports;
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [query, setQuery] = useState("");
    const [type, setType] = useState<ReportFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedReport, setSelectedReport] = useState<TaskReport | null>(null);

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

    const visible = useMemo(() => filterTaskReports(reports, { type, query }), [query, reports, type]);
    const labels = { issue: copy.issue, note: copy.note, photo: copy.photo };

    return (
        <div className={`h-full overflow-y-auto px-[3%] py-5 md:px-7 md:py-6 ${scrollHide}`}>
            <div className="mx-auto w-full max-w-6xl space-y-4">
                <header>
                    <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-[var(--text-main)] md:text-2xl">
                        <ShieldAlert className="h-5 w-5 text-accent md:h-6 md:w-6" />
                        {copy.title}
                    </h1>
                    <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                        {copy.subtitle}
                    </p>
                </header>

                <section className="space-y-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2.5 shadow-sm sm:p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        <Input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder={copy.search}
                            className="h-9 rounded-xl border-[var(--border-soft)] bg-[var(--bg-secondary)] pl-9 text-sm"
                        />
                    </div>
                    <PremiumTabs<ReportFilter>
                        tabs={[
                            { id: "all", label: copy.all },
                            { id: "issue", label: copy.issue, icon: ShieldAlert },
                            { id: "note", label: copy.note, icon: FileText },
                            { id: "photo", label: copy.photo, icon: Camera },
                        ]}
                        activeTab={type}
                        onChange={setType}
                    />
                </section>

                {loading && <p className="py-14 text-center text-sm text-[var(--text-muted)]">{copy.loading}</p>}
                {!loading && error && (
                    <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 text-sm text-[var(--btn-cancel-text)]">
                        {copy.error}
                    </div>
                )}
                {!loading && !error && visible.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                        {copy.empty}
                    </div>
                )}

                <section className="grid items-start gap-2 md:grid-cols-2">
                    {visible.map(report => (
                        <TaskReportCard key={report.id} report={report} locale={locale} labels={labels} onOpen={setSelectedReport} />
                    ))}
                </section>
            </div>

            <TaskReportDetailDialog report={selectedReport} locale={locale} labels={labels} copy={copy} onClose={() => setSelectedReport(null)} />
        </div>
    );
}
