import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarClock, CalendarX2, CheckCircle2, ClipboardCheck, ShieldAlert, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskItem } from "@/types/user";
import type { OperationsOverview, AgendaFilter } from "@/domain/tasks/operations-overview";
import type { QualityIncident } from "@/services/quality.service";
import type { OverviewResource } from "./useOverviewData";
import type { OverviewCopy } from "./overview-copy";

export function OverviewAttention({ data, incidents, c, onFilter, onList }: {
    data: OperationsOverview; incidents: OverviewResource<QualityIncident[]>; c: OverviewCopy;
    onFilter: (filter: AgendaFilter) => void; onList: (title: string, tasks: TaskItem[]) => void;
}) {
    const notices = [
        { title: c.unassigned, hint: c.assignHint, items: data.unassigned, icon: UserRoundPlus, action: () => onFilter("unassigned") },
        { title: c.late, hint: c.lateHint, items: data.late, icon: AlarmClock, action: () => onFilter("late") },
        { title: c.accept, hint: c.acceptHint, items: data.awaitingAcceptance, icon: ClipboardCheck, action: () => onList(c.accept, data.awaitingAcceptance) },
        { title: c.review, hint: c.reviewHint, items: data.review, icon: ClipboardCheck, action: () => onFilter("review") },
        { title: c.unscheduled, hint: c.unscheduledHint, items: data.unscheduled, icon: CalendarX2, action: () => onList(c.unscheduled, data.unscheduled) },
        { title: c.carriedOver, hint: c.carriedOverHint, items: data.carriedOver, icon: CalendarClock, action: () => onList(c.carriedOver, data.carriedOver) },
    ].filter(notice => notice.items.length > 0);
    const openIssues = incidents.value.filter(incident => incident.status === "open" || incident.status === "in_progress");
    return <section className="wh-overview-panel" aria-labelledby="overview-attention-title">
        <header className="wh-overview-section-heading"><div><h2 id="overview-attention-title">{c.attention}</h2><p>{c.attentionHint}</p></div><ShieldAlert className="size-4 text-amber-600" aria-hidden="true" /></header>
        <div className="wh-overview-attention-list">
            {notices.length === 0 && <p className="wh-overview-calm"><CheckCircle2 aria-hidden="true" />{c.noAttention}</p>}
            {notices.map(notice => <Button key={notice.title} type="button" variant="ghost" className="wh-overview-alert" onClick={notice.action}>
                <span className="wh-overview-alert-icon"><notice.icon className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><strong>{notice.title}</strong><span className="wh-overview-alert-hint">{notice.hint}</span></span>
                <span className="wh-overview-alert-count">{notice.items.length}</span><ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>)}
            {incidents.state !== "denied" && <div className="wh-overview-issue-row"><div><strong>{c.issues}</strong><p>{c.issuesHint}</p></div><span>{incidents.state === "ready" ? openIssues.length : incidents.state === "loading" ? "…" : "—"}</span><Button asChild size="xs" variant="outline"><Link href="/dashboard/quality">{c.see}</Link></Button></div>}
        </div>
    </section>;
}
