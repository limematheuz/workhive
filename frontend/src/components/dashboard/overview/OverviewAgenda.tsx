"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { DataListTable } from "@/components/ui/data-list-table";
import { filterOverviewAgenda, overviewStatus, plannedDate, taskIsLate, taskWorkers, type AgendaFilter, type OperationsOverview } from "@/domain/tasks/operations-overview";
import { isTaskDateOnlyValue } from "@/domain/tasks/task-schedule";
import type { TaskItem } from "@/types/user";
import type { OverviewCopy } from "./overview-copy";
import { formatOverviewDate } from "./overview-format";

export type OverviewTaskPresentation = {
    c: OverviewCopy; locale: string; now: Date;
    locationName: (id: number) => string;
    workerName: (id: number, fallback?: string | null) => string;
};

export function OverviewTaskStatus({ task, c, now }: { task: TaskItem; c: OverviewCopy; now: Date }) {
    const status = overviewStatus(task);
    const late = taskIsLate(task, now);
    return <Badge variant="secondary" className={late ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : status === "completed" ? "border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]" : status === "progress" ? "bg-[var(--brand-blue-soft)] text-accent" : ""}>
        {late ? c.late : c[status]}
    </Badge>;
}

export function OverviewTaskTime({ task, c, locale }: { task: TaskItem; c: OverviewCopy; locale: string }) {
    const value = task.scheduled_start_at || task.due_at;
    const date = plannedDate(task);
    if (!value || !date) return <span>{c.unscheduled}</span>;
    const hasTime = !isTaskDateOnlyValue(value) && !/^\d{4}-\d{2}-\d{2}$/.test(value);
    return <span className="wh-overview-task-time"><strong>{hasTime ? formatOverviewDate(date, locale, "time") : c.noTime}</strong><span>{formatOverviewDate(date, locale, "short")}</span></span>;
}

export function OverviewAgenda({ data, filter, onFilter, onOpen, presentation: p }: {
    data: OperationsOverview; filter: AgendaFilter; onFilter: (filter: AgendaFilter) => void; onOpen: (task: TaskItem) => void; presentation: OverviewTaskPresentation;
}) {
    const { c, now } = p;
    const items = filterOverviewAgenda(data, filter);
    const assignees = (task: TaskItem) => {
        const workers = taskWorkers(task);
        return workers.length ? workers.map(worker => p.workerName(worker.id, worker.name)).join(", ") : c.unassigned;
    };
    const statusTabs = (["all", "pending", "progress", "review", "completed"] as const).map(id => ({ id: id as AgendaFilter, label: c[id], badge: id === "all" ? data.planned.length : data[id].length }));
    if (filter === "unassigned" || filter === "late") statusTabs.push({ id: filter, label: c[filter], badge: data[filter].length });
    return <section id="overview-agenda" className="wh-overview-panel scroll-mt-4" aria-labelledby="overview-agenda-title">
        <header className="wh-overview-section-heading"><div><h2 id="overview-agenda-title">{c.agenda}</h2><p>{data.completed.length}/{data.planned.length} {c.done}</p></div><Button asChild variant="ghost" size="sm"><Link href="/dashboard/calendar"><CalendarDays />{c.calendar}</Link></Button></header>
        <div className="wh-overview-agenda-toolbar"><PremiumTabs tabs={statusTabs} activeTab={filter} onChange={onFilter} mobileLabel={c.status} /></div>
        {items.length === 0 ? <div className="wh-overview-empty"><CalendarDays aria-hidden="true" /><p>{filter === "all" ? c.noAgenda : c.noFiltered}</p><Button asChild variant="outline" size="sm"><Link href="/dashboard/tasks?tab=list">{c.manageTasks}<ArrowUpRight /></Link></Button></div> : <DataListTable items={items} getRowKey={task => task.id} onRowClick={onOpen} rowAriaLabel={task => `${c.openTask}: ${task.title}`} variant="plain"
            columns={[{ key: "time", label: c.time, className: "w-[15%]" }, { key: "task", label: c.task, className: "w-[38%]" }, { key: "team", label: c.assignee, className: "w-[27%]" }, { key: "status", label: c.status, className: "w-[20%]" }]}
            renderDesktopRow={task => [
                <OverviewTaskTime key="time" task={task} c={c} locale={p.locale} />,
                <div key="task"><p className="font-semibold text-[var(--text-main)]">{task.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{p.locationName(task.location_id)}</p></div>,
                <span key="team" className={`text-xs ${taskWorkers(task).length ? "text-[var(--text-main)]" : "font-medium text-amber-700"}`}>{assignees(task)}</span>,
                <OverviewTaskStatus key="status" task={task} c={c} now={now} />,
            ]}
            renderCompactRow={task => <div className="space-y-2"><div className="flex items-center justify-between gap-2"><OverviewTaskTime task={task} c={c} locale={p.locale} /><OverviewTaskStatus task={task} c={c} now={now} /></div><p className="font-semibold">{task.title}</p><p className="text-xs text-[var(--text-muted)]">{p.locationName(task.location_id)}</p><p className="text-xs">{assignees(task)}</p></div>}
            empty={<div className="wh-overview-empty"><CalendarDays aria-hidden="true" /><p>{filter === "all" ? c.noAgenda : c.noFiltered}</p><Button asChild variant="outline" size="sm"><Link href="/dashboard/tasks?tab=list">{c.manageTasks}<ArrowUpRight /></Link></Button></div>}
        />}
    </section>;
}
