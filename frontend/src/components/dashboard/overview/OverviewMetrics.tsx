import type {StaffRoster} from "@/domain/tasks/overview-staff-roster";
import { Activity, AlarmClock, MapPin, Clock3, UserRoundPlus, Users } from "lucide-react";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { type OperationsOverview } from "@/domain/tasks/operations-overview";
import type { ActiveCompanySession } from "@/types/user";
import type { OverviewResource } from "./useOverviewData";
import { overviewHours, type OverviewCopy } from "./overview-copy";

export function OverviewMetrics({ data, sessions, copy: c, locale,roster=[],range }: {
    roster?:StaffRoster[];range:{start:Date;end:Date};data: OperationsOverview; sessions: OverviewResource<ActiveCompanySession[]>; copy: OverviewCopy; locale: string;
}) {
    const plannedMinutes=roster.length?roster.reduce((total,row)=>total+Math.max(0,Math.min(new Date(row.ends_at).getTime(),range.end.getTime())-Math.max(new Date(row.starts_at).getTime(),range.start.getTime()))/60000,0):data.plannedMinutes;
    const liveWorkers = new Set<number>();
    for (const session of sessions.value) if (session.user_id != null && !session.paused_at) liveWorkers.add(session.user_id);
    const liveCount = liveWorkers.size;
    const liveValue = sessions.state === "ready" ? String(liveCount) : sessions.state === "loading" ? "…" : "—";
    return <SummaryMetricGrid desktopColumns={6} aria-label={c.title} className="wh-overview-metrics">
        <SummaryMetricCard label={c.scheduledLocations} value={String(new Set([...data.planned.map(t=>t.location_id),...roster.map(r=>r.location_id)]).size)} icon={MapPin} description={`${c.planned}: ${data.planned.length}`} />
        <SummaryMetricCard label={c.team} value={String(data.team.length)} icon={Users} description={c.people} />
        <SummaryMetricCard label={c.live} value={liveValue} icon={Activity} description={sessions.state === "error" || sessions.state === "denied" ? c.unknown : c.liveDetail} />
        <SummaryMetricCard label={c.unassigned} value={String(data.unassigned.length)} icon={UserRoundPlus} description={c.assignHint} valueTone={data.unassigned.length ? "negative" : "default"} />
        <SummaryMetricCard label={c.late} value={String(data.late.length)} icon={AlarmClock} description={c.lateHint} valueTone={data.late.length ? "negative" : "default"} />
        <SummaryMetricCard label={c.hours} value={!roster.length&&data.missingDuration === data.planned.length && data.planned.length > 0 ? "—" : overviewHours(plannedMinutes, locale)} icon={Clock3} description={roster.length?(locale==="en"?"Scheduled staff hours":"Horas de personal programadas"):data.missingDuration ? `${data.missingDuration} ${c.missingDuration}` : locale === "en" ? "Scheduled service durations" : "Duración de servicios"} />
    </SummaryMetricGrid>;
}
