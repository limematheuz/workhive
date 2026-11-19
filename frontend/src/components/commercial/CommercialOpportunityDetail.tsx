"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OpportunityTimeline } from "./OpportunityTimeline";
import { opportunityStages, commercialDate, commercialFollowUpPending } from "@/lib/commercial-format";
import type { CommercialOpportunity, CommercialWorkspace } from "@/services/commercial-workspace.service";
const quoteStatuses: Record<string, string> = { draft: "Borrador", sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado", expired: "Vencido" };
export function CommercialOpportunityDetail({ item, access, timeZone, edit }: {
    item: CommercialOpportunity;
    access: CommercialWorkspace["access"];
    timeZone: string;
    edit: () => void;
}) {
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }), [timeZone]);
    const next = commercialDate(item.next_follow_up_at);
    return <aside className="space-y-4 rounded-2xl border bg-card p-4"><div><p className="text-xs font-medium text-muted-foreground">{item.client_name} · {item.relationship_status === "lead" ? "Lead" : "Cliente"}</p><h2 className="mt-1 text-lg font-semibold">{item.title}</h2><span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">{opportunityStages[item.stage]}</span></div>
 <dl className="grid gap-3 rounded-xl bg-muted/30 p-3 text-sm"><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Responsable</dt><dd className={item.owner_name ? "font-medium" : "font-medium text-orange-700"}>{item.owner_name ?? "Pendiente de asignar"}</dd></div><div><dt className="text-muted-foreground">Próximo seguimiento</dt><dd className={commercialFollowUpPending(item.stage, item.next_follow_up_at) ? "mt-1 font-medium text-orange-700" : "mt-1 font-medium"}>{next ? dates.format(next) : "Pendiente de programar"}</dd></div>{item.loss_reason && <div><dt className="text-muted-foreground">Motivo de pérdida</dt><dd className="mt-1">{item.loss_reason}</dd></div>}</dl>
 <div className="flex flex-wrap gap-2">{access.can_manage && <Button size="sm" variant="outline" onClick={edit}>Editar oportunidad</Button>}{access.can_calculate && <Button size="sm" asChild><Link href={"/dashboard/calculator?opportunity=" + item.id}>Calcular presupuesto</Link></Button>}</div>
 {item.linked_quotes.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold">Presupuestos vinculados</h3>{item.linked_quotes.map(quote => <p className="flex justify-between gap-2 text-sm" key={quote.id}>{access.can_view_quotes ? <Link className="underline" href={"/dashboard/quotes/" + quote.id}>{quote.number}</Link> : <span>{quote.number}</span>}<span>{quoteStatuses[quote.status] ?? quote.status}</span></p>)}</section>}
 <OpportunityTimeline key={item.id + ":" + item.updated_at} clientId={item.client_id} opportunityId={item.id} canManage={access.can_manage} timeZone={timeZone}/>
 <Link className="block border-t pt-3 text-xs underline" href="/dashboard/clients">Gestionar la ficha en Clientes</Link></aside>;
}
