import type { StaffRoster } from "@/domain/tasks/overview-staff-roster";
import { CheckCircle2, MapPin, UserRoundPlus, Users } from "lucide-react";
import { SummaryMetricCard } from "@/components/ui/summary-metric-card";
import { Button } from "@/components/ui/button";
import type { OperationsOverview } from "@/domain/tasks/operations-overview";
import type { TaskItem } from "@/types/user";
import { overviewHours, type OverviewCopy } from "./overview-copy";
import styles from "./operations-overview.module.css";

export function OverviewMetrics({ data, copy: c, locale, roster = [], rosterError, range, today, onList, onLocations, onTeam }: {
    roster?: StaffRoster[]; range: { start: Date; end: Date }; data: OperationsOverview;
    rosterError?: string;
    copy: OverviewCopy; locale: string; today: boolean; onList: (title: string, tasks: TaskItem[]) => void; onLocations: () => void; onTeam: () => void;
}) {
    const plannedMinutes = roster.length ? roster.reduce((total, row) => total + Math.max(0, Math.min(new Date(row.ends_at).getTime(), range.end.getTime()) - Math.max(new Date(row.starts_at).getTime(), range.start.getTime())) / 60000, 0) : data.plannedMinutes;
    const en = locale === "en";
    const allocationUnavailable = Boolean(rosterError);
    const unavailableLabel = en ? "Could not be checked" : "No se pudo comprobar";
    const locations = new Set([...data.planned.map(task => task.location_id), ...roster.map(row => row.location_id)]).size;
    const cards = [
        { label: `${c.scheduledLocations}${today ? en ? " today" : " hoy" : ""}`, value: String(locations), icon: MapPin, description: en ? "View locations" : "Ver ubicaciones", action: onLocations, warning: false },
        { label: en ? "Assigned workers" : "Trabajadores asignados", value: allocationUnavailable ? "—" : String(data.team.length), icon: Users, description: allocationUnavailable ? unavailableLabel : en ? "View assigned team" : "Ver equipo asignado", action: onTeam, disabled: allocationUnavailable, warning: allocationUnavailable },
        { label: en ? "Finished jobs" : "Trabajos terminados", value: en ? `${data.completed.length} of ${data.planned.length}` : `${data.completed.length} de ${data.planned.length}`, icon: CheckCircle2, description: en ? "Finished / scheduled" : "Terminados / previstos", action: () => onList(en ? "Finished jobs" : "Trabajos terminados", data.completed), warning: false },
        { label: c.unassigned, value: allocationUnavailable ? "—" : String(data.unassigned.length), icon: UserRoundPlus, description: allocationUnavailable ? unavailableLabel : en ? "Jobs without an assignee" : "Trabajos sin responsable", action: () => onList(c.unassigned, data.unassigned), disabled: allocationUnavailable, warning: allocationUnavailable || data.unassigned.length > 0 },
    ];
    return <div className={styles.numbers}><section aria-label={c.title} className={styles.metrics}>
        {cards.map(card => <Button key={card.label} type="button" variant="outline" aria-label={`${card.label}: ${card.value}. ${card.description}`} disabled={card.disabled} onClick={card.action} className={styles.metric}><SummaryMetricCard className={`${styles.metricCard} ${card.warning ? styles.warning : ""}`} label={card.label} value={card.value} icon={card.icon} description={card.description} /></Button>)}
    </section><p className={styles.hours}>{c.hours}: <strong>{!roster.length && data.missingDuration === data.planned.length && data.planned.length > 0 ? "—" : overviewHours(plannedMinutes, locale)}</strong>{data.missingDuration > 0 && !roster.length ? ` · ${data.missingDuration} ${c.missingDuration}` : ""}{roster.length ? en ? " · scheduled staff hours" : " · horas de plantilla programadas" : en ? " · service duration" : " · duración de los servicios"}</p></div>;
}
