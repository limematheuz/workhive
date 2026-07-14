"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Camera, FileText, MapPin, Search, ShieldAlert, UserRound, X } from "lucide-react";

import {
    filterTaskReports,
    getTaskReportMediaHref,
} from "@/features/task-reports/task-report-center";
import { useDictionary } from "@/lib/dictionary-context";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/dashboard/notifications/notification-utils";
import {
    TaskReportService,
    type TaskReport,
    type TaskReportType,
} from "@/services/task-report.service";


type ReportFilter = TaskReportType | "all";

export default function TaskReportsPage() {
    const { dict, locale } = useDictionary();
    const copy = dict.task_reports;
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [query, setQuery] = useState("");
    const [type, setType] = useState<ReportFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

    const loadReports = useEffectEvent(async () => {
        setError(false);
        try {
            const history = await TaskReportService.list();
            setReports(history);
            try {
                await TaskReportService.markNotificationsRead();
                window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
            } catch {
                // History remains usable; next visit/poll can retry alert acknowledgement.
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

    const visible = useMemo(
        () => filterTaskReports(reports, { type, query }),
        [query, reports, type],
    );

    const filters: Array<{ value: ReportFilter; label: string }> = [
        { value: "all", label: copy.all },
        { value: "issue", label: copy.issue },
        { value: "note", label: copy.note },
        { value: "photo", label: copy.photo },
        { value: "checklist_note", label: copy.checklist_note },
        { value: "checklist_photo", label: copy.checklist_photo },
    ];

    return (
        <main className="min-h-full bg-[var(--bg-main)] p-4 text-[var(--text-main)] sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex items-start gap-4">
                    <span className="rounded-2xl bg-blue-600/12 p-3 text-blue-600">
                        <ShieldAlert className="h-7 w-7" />
                    </span>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{copy.eyebrow}</p>
                        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{copy.title}</h1>
                        <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)] sm:text-base">{copy.subtitle}</p>
                    </div>
                </header>

                <section className="rounded-3xl border border-[var(--border-main)] bg-[var(--bg-secondary)] p-3 shadow-sm sm:p-4">
                    <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-main)] px-4 py-3">
                        <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder={copy.search}
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                        />
                    </label>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={copy.title}>
                        {filters.map(filter => (
                            <button
                                key={filter.value}
                                type="button"
                                role="tab"
                                aria-selected={type === filter.value}
                                onClick={() => setType(filter.value)}
                                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                                    type === filter.value
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                        : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </section>

                {loading && <p className="py-16 text-center text-[var(--text-muted)]">{copy.loading}</p>}
                {!loading && error && (
                    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-600">
                        {copy.error}
                    </div>
                )}
                {!loading && !error && visible.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-[var(--border-main)] p-14 text-center text-[var(--text-muted)]">
                        {copy.empty}
                    </div>
                )}

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visible.map(report => {
                        const mediaHref = getTaskReportMediaHref(report.media_url);
                        return (
                            <article
                                key={report.id}
                                className="overflow-hidden rounded-3xl border border-[var(--border-main)] bg-[var(--bg-secondary)] shadow-sm"
                            >
                                {mediaHref && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMedia(mediaHref)}
                                        className="relative block aspect-[16/10] w-full overflow-hidden bg-black/5"
                                        aria-label={copy.view_photo}
                                    >
                                        <Image
                                            src={mediaHref}
                                            alt={report.title || report.checklist_item_label || copy.view_photo}
                                            fill
                                            unoptimized
                                            className="object-cover transition duration-300 hover:scale-[1.02]"
                                        />
                                    </button>
                                )}
                                <div className="space-y-4 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="rounded-full bg-blue-600/12 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-600">
                                            {{
                                                issue: copy.issue,
                                                note: copy.note,
                                                photo: copy.photo,
                                                checklist_note: copy.checklist_note,
                                                checklist_photo: copy.checklist_photo,
                                            }[report.report_type]}
                                        </span>
                                        <time className="text-xs text-[var(--text-muted)]">
                                            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}
                                        </time>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black">{report.title || report.checklist_item_label || report.task_title}</h2>
                                        {report.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">{report.description}</p>}
                                    </div>
                                    <dl className="space-y-2 border-t border-[var(--border-main)] pt-4 text-sm">
                                        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>{report.location_name}</span></div>
                                        <div className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>{copy.task}: {report.task_title}</span></div>
                                        <div className="flex gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>{copy.reported_by}: {report.reporter_name} · {report.reporter_company_name}</span></div>
                                        {report.requesting_company_name && (
                                            <div className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>{copy.collaboration}: {report.reporter_company_name} → {report.requesting_company_name}</span></div>
                                        )}
                                    </dl>
                                </div>
                            </article>
                        );
                    })}
                </section>
            </div>

            {selectedMedia && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
                    <button
                        type="button"
                        onClick={() => setSelectedMedia(null)}
                        className="absolute right-5 top-5 rounded-full bg-white p-2 text-black"
                        aria-label={copy.close_photo}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="relative h-[80vh] w-full max-w-6xl">
                        <Image src={selectedMedia} alt={copy.view_photo} fill unoptimized className="object-contain" />
                    </div>
                </div>
            )}
        </main>
    );
}
