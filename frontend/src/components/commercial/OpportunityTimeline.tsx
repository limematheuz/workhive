"use client";
import { FormSelect } from "@/components/ui/form-select";
import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClientService, type ClientOpportunityActivity, type ClientOpportunityActivityType } from "@/services/client.service";
import { activityLabels, opportunityStages, commercialDate } from "@/lib/commercial-format";
export function OpportunityTimeline({ clientId, opportunityId, canManage, timeZone }: {
    clientId: number;
    opportunityId: number;
    canManage: boolean;
    timeZone: string;
}) {
    const [activities, setActivities] = useState<ClientOpportunityActivity[]>([]), [kind, setKind] = useState<ClientOpportunityActivityType>("note"), [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => { let active = true; ClientService.getClientOpportunityActivities(clientId, opportunityId).then(rows => { if (active)
        setActivities(rows); }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [clientId, opportunityId]);
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone }), [timeZone]);
    return <section className="space-y-3"><h3 className="text-sm font-semibold">Historial y actividad</h3>{error && <p role="alert" className="text-sm text-orange-700">{error}</p>}{canManage && <form className="space-y-2 rounded-xl bg-muted/30 p-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        const item = await ClientService.createClientOpportunityActivity(clientId, opportunityId, { activity_type: kind, body });
        setActivities(rows => [item, ...rows]);
        setBody("");
        setError("");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo registrar.");
    }
    finally {
        setBusy(false);
    } }}><fieldset disabled={busy} className="space-y-2"><label className="block text-xs">Tipo de actividad<FormSelect aria-label="Tipo de actividad" className="staff-select" value={kind} onValueChange={e => setKind(e as ClientOpportunityActivityType)}>{["note", "call", "email", "meeting"].map(value => <option key={value} value={value}>{activityLabels[value]}</option>)}</FormSelect></label><Textarea required maxLength={2000} aria-label="Detalle de la actividad" placeholder="Resultado de la conversación o siguiente paso" value={body} onChange={e => setBody(e.target.value)}/><Button size="sm">Registrar actividad</Button></fieldset><p className="text-xs text-muted-foreground">Este registro se guarda en el historial comercial.</p></form>}
 <ol className="divide-y">{activities.map(activity => <li key={activity.id} className="space-y-1 py-3 text-sm"><div className="flex justify-between gap-2"><strong>{activityLabels[activity.activity_type]}</strong><time className="text-xs text-muted-foreground">{commercialDate(activity.happened_at) ? dates.format(commercialDate(activity.happened_at)!) : "Fecha pendiente"}</time></div>{activity.activity_type === "stage_change" ? <p>{activity.stage_from ? opportunityStages[activity.stage_from] : "Inicio"} → {activity.stage_to ? opportunityStages[activity.stage_to] : ""}</p> : <p className="whitespace-pre-wrap">{activity.body}</p>}<p className="text-xs text-muted-foreground">{activity.actor_name ?? "Usuario anterior"}</p></li>)}</ol>{!activities.length && <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>}</section>;
}
