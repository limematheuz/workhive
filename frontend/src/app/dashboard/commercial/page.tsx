"use client";
import { FormSelect } from "@/components/ui/form-select";
import { useCallback, useMemo, useState } from "react";
import { Target, Plus, UsersRound, Clock3, ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { SummaryMetricGrid, SummaryMetricCard } from "@/components/ui/summary-metric-card";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { opportunityStages, commercialDate, commercialFollowUpPending } from "@/lib/commercial-format";
import { readCommercialWorkspace, type CommercialWorkspace, type CommercialOpportunity, type CommercialAccount } from "@/services/commercial-workspace.service";
import { OpportunityForm } from "@/components/commercial/OpportunityForm";
import { LeadAccountForm } from "@/components/commercial/LeadAccountForm";
import { CommercialOpportunityDetail } from "@/components/commercial/CommercialOpportunityDetail";
const columns: DataListColumn[] = [{ key: "account", label: "Oportunidad / cuenta", className: "w-[40%]" }, { key: "stage", label: "Fase", className: "w-[16%]" }, { key: "owner", label: "Responsable", className: "w-[20%]" }, { key: "followup", label: "Próximo seguimiento", className: "w-[24%]" }];
export default function CommercialPage() {
    const { user, loading } = useUser();
    const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [stage, setStage] = useState(""), [attention, setAttention] = useState(false), [offset, setOffset] = useState(0), [revision, setRevision] = useState(0), [selected, setSelected] = useState<number | null>(null), [edit, setEdit] = useState<CommercialOpportunity | null | undefined>(undefined), [leadOpen, setLeadOpen] = useState(false), [initial, setInitial] = useState<CommercialAccount | null>(null), [error, setError] = useState("");
    const key = `${user?.company_id}:${query}:${stage}:${attention}:${offset}:${revision}`;
    const [result, setResult] = useState<{
        key: string;
        data: CommercialWorkspace;
    } | null>(null);
    const request = useCallback(() => readCommercialWorkspace({ search: query, stage, attention, offset }), [query, stage, attention, offset]);
    const receive = useCallback((data: CommercialWorkspace) => { setResult({ key, data }); setError(""); }, [key]);
    const failed = useCallback((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar el seguimiento."), []);
    useResourceEffect(Boolean(user), key, request, receive, failed);
    const data = result?.key === key ? result.data : null;
    const current = data?.items.find(item => item.id === selected) ?? data?.items[0];
    const refresh = () => { setError(""); setRevision(value => value + 1); };
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: data?.timezone ?? "Europe/Madrid" }), [data?.timezone]);
    if (loading)
        return <p>Cargando…</p>;
    const next = (item: CommercialOpportunity) => { const value = commercialDate(item.next_follow_up_at); return <span className={commercialFollowUpPending(item.stage, item.next_follow_up_at) ? "text-orange-700" : ""}>{value ? dates.format(value) : "Pendiente de programar"}</span>; };
    return <div className="dashboard-page-content space-y-4"><PageHeader icon={Target} title="Oportunidades y leads" subtitle="Seguimiento comercial con responsables, próximas acciones e historial compartido." actions={<><Button variant="outline" onClick={refresh} aria-label="Actualizar seguimiento comercial"><RefreshCw size={16}/></Button>{data?.access.can_create_account && <Button variant="outline" onClick={() => setLeadOpen(true)}>Nuevo lead</Button>}{data?.access.can_manage && <Button onClick={() => { setInitial(null); setEdit(null); }}><Plus size={16}/>Nueva oportunidad</Button>}</>}/>
 {data && <SummaryMetricGrid aria-label="Actividad comercial de la empresa"><SummaryMetricCard icon={UsersRound} label="Leads activos" value={String(data.summary.leads)} description="Contactos potenciales registrados"/><SummaryMetricCard icon={Target} label="Oportunidades abiertas" value={String(Object.entries(data.summary.stages).reduce((sum, [stage, count]) => sum + (!["won", "lost"].includes(stage) ? count : 0), 0))} description="Resumen de toda la empresa"/><SummaryMetricCard icon={Clock3} label="Seguimientos vencidos" value={String(data.summary.overdue)} valueTone={data.summary.overdue ? "negative" : "default"} description={data.summary.unscheduled + " sin fecha de seguimiento"}/><SummaryMetricCard icon={ChartNoAxesCombined} label="Cierre ganado" value={data.summary.win_rate === null ? "—" : data.summary.win_rate + "%"} description="Ganadas sobre oportunidades cerradas"/></SummaryMetricGrid>}
 <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3" onSubmit={e => { e.preventDefault(); setOffset(0); setQuery(search.trim()); }}><label className="min-w-48 flex-1 text-sm">Buscar<Input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Oportunidad, cliente o lead"/></label><label className="text-sm">Fase<FormSelect aria-label="Fase de la oportunidad" className="staff-select" value={stage} onValueChange={e => { setStage(e); setOffset(0); }}><option value="">Todas las fases</option>{Object.entries(opportunityStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FormSelect></label><label className="flex h-9 items-center gap-2 text-sm"><Checkbox checked={attention} onCheckedChange={checked => { setAttention(checked === true); setOffset(0); }}/>Necesita seguimiento</label><Button variant="outline">Buscar</Button></form>
 {error && <p role="alert" className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950">{error}</p>}{!data && !error && <p role="status" className="text-sm text-muted-foreground">Cargando oportunidades…</p>}
 {data && <><div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(21rem,1fr)]"><section className="min-w-0 rounded-2xl border bg-card"><DataListTable variant="plain" items={data.items} getRowKey={item => item.id} columns={columns} onRowClick={item => setSelected(item.id)} rowAriaLabel={item => "Abrir oportunidad " + item.title} renderDesktopRow={item => [<div key="account"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.client_name} · {item.relationship_status === "lead" ? "Lead" : "Cliente"}</span></div>, <span key="stage" className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">{opportunityStages[item.stage]}</span>, <span key="owner" className={item.owner_name ? "text-sm" : "text-sm text-orange-700"}>{item.owner_name ?? "Sin responsable"}</span>, <span key="followup" className="text-xs">{next(item)}</span>]} renderCompactRow={item => <div className="space-y-2"><div className="flex justify-between gap-2"><strong>{item.title}</strong><span className="text-xs">{opportunityStages[item.stage]}</span></div><p className="text-xs text-muted-foreground">{item.client_name} · {item.owner_name ?? "Sin responsable"}</p><p className="text-xs">{next(item)}</p></div>}/>{!data.items.length && <p className="p-5 text-sm text-muted-foreground">No hay oportunidades en esta búsqueda.</p>}<div className="flex items-center justify-between gap-2 border-t p-3 text-xs"><span>Desde {offset + 1} · {data.items.length} registros</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 100))}>Anterior</Button><Button size="sm" variant="outline" disabled={!data.has_more} onClick={() => setOffset(value => value + 100)}>Siguiente</Button></div></div></section>
 {current && <CommercialOpportunityDetail item={current} access={data.access} timeZone={data.timezone} edit={() => { setInitial(null); setEdit(current); }}/>}</div><p className="text-xs text-muted-foreground">Fechas mostradas en {data.timezone}. Los indicadores se calculan con los registros activos de la empresa.</p></>}
 {edit !== undefined && <OpportunityForm key={edit?.id ?? "new-" + initial?.id} item={edit} initialAccount={initial} close={() => setEdit(undefined)} saved={() => { setEdit(undefined); refresh(); }}/>}{leadOpen && <LeadAccountForm close={() => setLeadOpen(false)} saved={client => { setLeadOpen(false); setInitial({ id: client.id, name: client.name, relationship_status: "lead" }); if (data?.access.can_manage)
        setEdit(null); refresh(); }}/>}</div>;
}
