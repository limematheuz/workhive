import Link from "next/link";
import { Activity, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { overviewStatus, type OperationsOverview } from "@/domain/tasks/operations-overview";
import type { ActiveCompanySession } from "@/types/user";
import type { OverviewResource } from "./useOverviewData";
import type { OverviewTaskPresentation } from "./OverviewAgenda";

export function OverviewTeam({ data, sessions, presentation: p, containsNow }: {
    data: OperationsOverview; sessions: OverviewResource<ActiveCompanySession[]>; presentation: OverviewTaskPresentation; containsNow: boolean;
}) {
    const { c } = p;
    const people = new Map(data.team.map(person => [person.id, person]));
    const items = [...people.values()].sort((a, b) => p.workerName(a.id, a.name).localeCompare(p.workerName(b.id, b.name), p.locale));
    const personInfo = (person: OperationsOverview["team"][number]) => {
        const live = containsNow ? sessions.value.find(session => session.user_id === person.id) : undefined;
        const completed = person.tasks.filter(task => overviewStatus(task) === "completed").length;
        const next = person.tasks.find(task => overviewStatus(task) !== "completed");
        const state = live ? live.paused_at ? c.paused : c.working : person.tasks.length > 0 && completed === person.tasks.length ? c.finished : c.plannedState;
        return { live, completed, next, state };
    };
    return <section id="overview-team" className="wh-overview-panel" aria-labelledby="overview-team-title">
        <header className="wh-overview-section-heading"><div><h2 id="overview-team-title">{c.teamTitle} <span className="wh-overview-heading-count">{items.length}</span></h2></div>{sessions.state !== "denied" && <Button asChild variant="ghost" size="sm"><Link href="/dashboard/live-work"><Activity />{c.liveLink}</Link></Button>}</header>
        {items.length === 0 ? <div className="wh-overview-empty"><Users aria-hidden="true" /><p>{c.noTeam}</p></div> : <DataListTable items={items} getRowKey={person => person.id} variant="plain" columns={[
            { key: "name", label: c.assignee, className: "w-[28%]" }, { key: "state", label: c.status, className: "w-[22%]" }, { key: "next", label: c.next, className: "w-[30%]" }, { key: "progress", label: c.completed, className: "w-[20%]" },
        ]} renderDesktopRow={person => {
            const info = personInfo(person);
            return [
                <span key="name" className="font-semibold">{p.workerName(person.id, person.name)}</span>,
                <Badge key="state" variant="secondary" className={info.live && !info.live.paused_at ? "bg-[var(--status-active-bg)] text-[var(--status-active-text)]" : ""}>{info.state}</Badge>,
                <span key="next" className="text-xs text-[var(--text-muted)]">{info.live ? info.live.task_title || info.live.location_name : info.next?.title || c.noNext}</span>,
                <div key="progress"><span className="text-xs tabular-nums">{info.completed}/{person.tasks.length}</span><progress className="wh-overview-progress" value={info.completed} max={person.tasks.length || 1} aria-label={`${p.workerName(person.id, person.name)}: ${info.completed} ${c.completedOf} ${person.tasks.length}`} /></div>,
            ];
        }} renderCompactRow={person => {
            const info = personInfo(person);
            return <div className="space-y-2"><div className="flex items-center justify-between gap-2"><strong>{p.workerName(person.id, person.name)}</strong><Badge variant="secondary">{info.state}</Badge></div><p className="text-xs text-[var(--text-muted)]">{info.live?.task_title || info.next?.title || c.noNext}</p><p className="text-xs">{info.completed}/{person.tasks.length} {c.done}</p></div>;
        }} empty={<div className="wh-overview-empty"><Users aria-hidden="true" /><p>{c.noTeam}</p></div>} />}
        {!containsNow && <p className="wh-overview-footnote">{c.liveOutside}</p>}
        {sessions.state === "error" && <p className="wh-overview-footnote">{c.live}: {c.unknown}</p>}
    </section>;
}
