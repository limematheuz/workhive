"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, LayoutDashboard, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataListTable } from "@/components/ui/data-list-table";
import { useDictionary } from "@/lib/dictionary-context";
import { toTaskPlanningDateInput } from "@/domain/tasks/task-schedule";
import { canManageCompanyTasks } from "@/domain/access/roles";
import { buildOperationsOverview, isInOverviewRange, overviewRange, type AgendaFilter, type OverviewPeriod } from "@/domain/tasks/operations-overview";
import type { TaskItem, User } from "@/types/user";
import type { Location } from "@/services/location.service";
import { TechTaskDetails } from "../TechTaskDetails";
import {applyStaffRoster} from "@/domain/tasks/overview-staff-roster";
import {useOverviewRoster} from "./useOverviewRoster";
import { OverviewMetrics } from "./OverviewMetrics";
import { OverviewAgenda, OverviewTaskStatus, OverviewTaskTime, type OverviewTaskPresentation } from "./OverviewAgenda";
import { OverviewAttention } from "./OverviewAttention";
import { OverviewLocations } from "./OverviewLocations";
import { OverviewTeam } from "./OverviewTeam";
import { OverviewForecast } from "./OverviewUpcoming";
import { useOverviewData } from "./useOverviewData";
import { useOverviewTaskSelection } from "./useOverviewTaskSelection";
import { overviewCopy } from "./overview-copy";
import { formatOverviewDate } from "./overview-format";
import styles from "./operations-overview.module.css";

export function OperationsDashboard({ currentUser, tasks, locations, onTaskUpdate }: {
    currentUser: User; tasks: TaskItem[]; locations: Location[]; onTaskUpdate: () => void;
}) {
    const { locale } = useDictionary();
    const c = overviewCopy[locale === "en" ? "en" : "es"];
    const [now, setNow] = useState(() => new Date());
    const [period, setPeriod] = useState<OverviewPeriod>("today");
    const [date, setDate] = useState(() => toTaskPlanningDateInput(new Date().toISOString()));
    const [filter, setFilter] = useState<AgendaFilter>("all");
    const [list, setList] = useState<{ title: string; tasks: TaskItem[] } | null>(null);
    const range = overviewRange(period, date, now);
    const roster=useOverviewRoster(range.start.toISOString(),range.end.toISOString(),currentUser.company_id,now.getTime());
    const data = applyStaffRoster(buildOperationsOverview(tasks, range, now),roster.rows);
    const todayData = buildOperationsOverview(tasks, overviewRange("today", date, now), now);
    const extra = useOverviewData(currentUser);
    const selection = useOverviewTaskSelection(tasks, currentUser.id);
    const containsNow = isInOverviewRange(now, range);
    const p: OverviewTaskPresentation = {
        c, locale, now,
        locationName: id => locations.find(location => location.id === id)?.name || `${c.noLocation} #${id}`,
        locationAddress: id => { const location = locations.find(item => item.id === id); return [location?.address?.trim(), location?.city?.trim()].filter(Boolean).join(", "); },
        workerName: (id, fallback) => roster.rows.find(row=>row.account_user_id===id||-(row.effective_employee_id??row.employee_id)===id)?.employee_name || extra.users.value.find(user => user.id === id)?.full_name || fallback || extra.sessions.value.find(session => session.user_id === id)?.user_name || `${c.noName} #${id}`,
    };
    const periodLabel = `${formatOverviewDate(range.start, locale, "period")}${period === "week" ? ` – ${formatOverviewDate(new Date(range.end.getTime() - 1), locale, "period")}` : ""}`;
    const changePeriod = (value: OverviewPeriod) => { setPeriod(value); setFilter("all"); };
    const focusTeam = () => { document.getElementById("overview-more")?.setAttribute("open", ""); document.getElementById("overview-team")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const resources = [extra.sessions, extra.users, extra.incidents];
    const hasErrors = Boolean(roster.error)||resources.some(resource => resource.state === "error");
    const taskUpdated=()=>{setNow(new Date());onTaskUpdate();void extra.reload();};

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    return <div className={`dashboard-page-content wh-operations-overview ${styles.root}`}>
        <PageHeader icon={LayoutDashboard} title={c.title} subtitle={c.subtitle} actions={<><Button type="button" variant="outline" size="sm" aria-label={c.retry} onClick={() => { onTaskUpdate(); void extra.reload(); setNow(new Date()); }}><RefreshCw />{c.retry}</Button><Button asChild size="sm" variant="outline"><Link href="/dashboard/calendar"><CalendarDays />{c.calendar}</Link></Button>{canManageCompanyTasks(currentUser) && <Button asChild size="sm"><Link href="/dashboard/planificar"><Plus />{locale === "en" ? "Plan service" : "Planificar trabajo"}</Link></Button>}</>} />
        <div className="wh-overview-period-bar"><div className="wh-overview-period-tabs"><PremiumTabs activeTab={period} onChange={changePeriod} mobileLabel={c.period} tabs={[{ id: "today", label: c.today }, { id: "tomorrow", label: c.tomorrow }, { id: "week", label: c.week }, { id: "date", label: c.date }]} /></div><div className="wh-overview-period-date">{period === "date" ? <DatePicker id="overview-date" value={date} onValueChange={value => { if (value) { setDate(value); setFilter("all"); } }} aria-label={c.chooseDate} /> : <p>{periodLabel}</p>}</div></div>
        {hasErrors && <div role="status" className="wh-overview-resource-warning">{c.syncError}<Button type="button" variant="ghost" size="xs" onClick={() => { setNow(new Date()); void extra.reload(); }}>{c.retry}</Button></div>}
        {roster.loading?<div role="status" className="wh-overview-panel p-6 text-sm text-muted-foreground">{locale==="en"?"Loading scheduled staff and work allocation…":"Cargando plantilla programada y reparto del trabajo…"}</div>:<>
        <div className={styles.top}>
            <OverviewMetrics roster={roster.rows} rosterError={roster.error} range={range} data={data} today={period === "today"} onList={(title, items) => setList({title, tasks:items})} onLocations={() => document.getElementById("overview-locations")?.scrollIntoView({ behavior: "smooth", block: "start" })} onTeam={focusTeam} copy={c} locale={locale} />
            <OverviewAttention data={todayData} incidents={extra.incidents} c={c} locale={locale} now={now} onList={(title, items) => setList({ title, tasks: items })} />
        </div>
        <OverviewLocations roster={roster.rows} rosterUnavailable={Boolean(roster.error)} data={data} presentation={p} day={range.start} onOpen={selection.open} />
        </>}
        <details id="overview-more" className="wh-overview-panel"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{locale === "en" ? "View agenda and assigned team" : "Ver agenda y equipo asignado"}</summary><OverviewAgenda data={data} filter={filter} onFilter={setFilter} onOpen={selection.open} presentation={p} /><OverviewTeam data={data} sessions={extra.sessions} presentation={p} containsNow={containsNow} /></details>
        <OverviewForecast tasks={tasks} now={now} locale={locale} onDay={(day, items) => setList({ title: `${locale === "en" ? "Scheduled services" : "Servicios programados"} · ${formatOverviewDate(day, locale, "period")}`, tasks: items })} />
        {selection.selected && <TechTaskDetails task={selection.selected} location={locations.find(location => location.id === selection.selected?.location_id) || null} locationName={p.locationName(selection.selected.location_id)} currentUser={currentUser} onBack={selection.close} onStatusUpdate={taskUpdated} />}
        <Dialog open={Boolean(list)} onOpenChange={open => { if (!open) setList(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{list?.title}</DialogTitle><DialogDescription>{list?.tasks.length || 0} {c.tasks}</DialogDescription></DialogHeader><DataListTable items={list?.tasks || []} getRowKey={task => task.id} variant="plain" onRowClick={task => { setList(null); selection.open(task); }} rowAriaLabel={task => `${c.openTask}: ${task.title}`} columns={[{ key: "title", label: c.task, className: "w-1/2" }, { key: "time", label: c.time, className: "w-1/4" }, { key: "status", label: c.status, className: "w-1/4" }]} renderDesktopRow={task => [<div key="title"><strong>{task.title}</strong><p className="mt-1 text-xs text-[var(--text-muted)]">{p.locationName(task.location_id)}</p></div>, <OverviewTaskTime key="time" task={task} c={c} locale={locale} />, <OverviewTaskStatus key="status" task={task} c={c} now={now} />]} renderCompactRow={task => <div className="space-y-2"><strong>{task.title}</strong><p className="text-xs">{p.locationName(task.location_id)}</p><OverviewTaskStatus task={task} c={c} now={now} /></div>} /></DialogContent></Dialog>
    </div>;
}
