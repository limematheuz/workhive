import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarClock, CalendarX2, CheckCircle2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskItem } from "@/types/user";
import type { OperationsOverview } from "@/domain/tasks/operations-overview";
import type { QualityIncident } from "@/services/quality.service";
import type { OverviewResource } from "./useOverviewData";
import type { OverviewCopy } from "./overview-copy";
import styles from "./operations-overview.module.css";

/** Today's action groups stay separate from the summary's selectable period. */
export function OverviewAttention({ data, incidents, c, locale, now, onList }: {
    data: OperationsOverview; incidents: OverviewResource<QualityIncident[]>; c: OverviewCopy; locale: string; now: Date;
    onList: (title: string, tasks: TaskItem[]) => void;
}) {
    const en = locale === "en";
    const notices = [
        { title: en ? "Late today" : "Con retraso hoy", items: data.late, icon: AlarmClock },
        { title: en ? "Awaiting review today" : "Por revisar hoy", items: data.review, icon: ClipboardCheck },
        { title: en ? "Awaiting acceptance today" : "Por aceptar hoy", items: data.awaitingAcceptance, icon: ClipboardCheck },
    ].filter(notice => notice.items.length > 0);
    const openIssues = incidents.value.filter(incident => incident.status === "open" || incident.status === "in_progress");
    const pending = [
        { title: en ? "Jobs from previous days" : "Trabajos de días anteriores", items: data.carriedOver, icon: CalendarClock },
        { title: en ? "Jobs without a date" : "Trabajos sin fecha", items: data.unscheduled, icon: CalendarX2 },
    ].filter(notice => notice.items.length > 0);
    return <section className={styles.attention} aria-labelledby="overview-attention-title">
        <header className={styles.attentionHeader}><h2 id="overview-attention-title">{c.attention}</h2><span>{c.today} · {now.toLocaleDateString(locale, { day: "numeric", month: "short" })}</span></header>
        {notices.length === 0 && <p className={styles.calm}><CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />{en ? "No delayed jobs or reviews today" : "Sin retrasos ni revisiones hoy"}</p>}
        {notices.map(notice => <Button key={notice.title} type="button" variant="ghost" className={`${styles.notice} ${styles.warning}`} onClick={() => onList(notice.title, notice.items)}><notice.icon className="size-4 shrink-0" aria-hidden="true" /><span className={styles.noticeLabel}>{notice.title}</span><span className={styles.noticeCount}>{notice.items.length}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Button>)}
        {incidents.state !== "denied" && <Button asChild variant="ghost" className={`${styles.notice} ${openIssues.length ? styles.warning : ""}`}><Link href="/dashboard/quality?tab=incidents&status=active"><ShieldAlert className="size-4 shrink-0" aria-hidden="true" /><span className={styles.noticeLabel}>{c.issues}<span className="block text-xs font-normal text-muted-foreground">{incidents.state === "error" ? en ? "Unavailable · open Quality" : "No disponible · abrir Calidad" : en ? "Open or being followed up" : "Abiertas o en seguimiento"}</span></span><span className={styles.noticeCount}>{incidents.state === "ready" ? openIssues.length : incidents.state === "loading" ? "…" : "—"}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link></Button>}
        {pending.map(notice => <Button key={notice.title} type="button" variant="ghost" className={styles.notice} onClick={() => onList(notice.title, notice.items)}><notice.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className={styles.noticeLabel}>{notice.items.length} {notice.title.toLocaleLowerCase(locale)}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Button>)}
    </section>;
}
