"use client";

import * as React from "react";
import { CircleDollarSign, Clock3, Loader2, Plus, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { FinanceLoadError } from "@/components/finance/FinanceLoadError";
import { useViewState } from "@/hooks/useViewState";
import { canManageLaborCosts, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { LaborCostService, type LaborCostRate, type LaborCostSummary } from "@/services/labor-cost.service";
import { OrganizationService, type OrganizationMember } from "@/services/organization.service";

function today() {
    return new Date().toISOString().slice(0, 10);
}

function NewLaborCostDialog({
    open,
    onOpenChange,
    members,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    members: OrganizationMember[];
    onCreated: (rate: LaborCostRate) => void;
}) {
    const [membershipId, setMembershipId] = React.useState("");
    const [hourlyCost, setHourlyCost] = React.useState("");
    const [effectiveOn, setEffectiveOn] = React.useState(today);
    const [saving, setSaving] = React.useState(false);

    const reset = () => {
        setMembershipId("");
        setHourlyCost("");
        setEffectiveOn(today());
    };
    const submit = async () => {
        if (!membershipId || !hourlyCost || !effectiveOn) {
            toast.error("Selecciona una persona e indica el coste y la fecha de vigencia.");
            return;
        }
        setSaving(true);
        try {
            const rate = await LaborCostService.createRate({
                company_membership_id: Number(membershipId),
                hourly_cost: hourlyCost,
                effective_on: effectiveOn,
            });
            onCreated(rate);
            reset();
            onOpenChange(false);
            toast.success("Coste interno guardado.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo guardar el coste interno."));
        } finally {
            setSaving(false);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-lg" confirmDiscard>
            <DialogHeader>
                <DialogTitle>Nuevo coste laboral</DialogTitle>
                <DialogDescription>Guarda un coste interno por hora. No es una nómina y solo lo pueden consultar los administradores de empresa.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
                <div className="grid gap-2"><Label htmlFor="labor-cost-member">Persona</Label><SearchableSelect id="labor-cost-member" aria-label="Buscar persona activa" value={membershipId} onValueChange={setMembershipId} placeholder="Buscar persona activa…" options={members.map(member=>({value:String(member.id),label:member.full_name||member.email,description:member.email}))}/></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="labor-cost-hour">Coste interno por hora</Label><Input id="labor-cost-hour" inputMode="decimal" type="number" min="0" step="0.01" value={hourlyCost} onChange={(event) => setHourlyCost(event.target.value)} placeholder="0,00" /></div><div className="grid gap-2"><Label htmlFor="labor-cost-effective">Vigente desde</Label><DatePicker id="labor-cost-effective" value={effectiveOn} onValueChange={setEffectiveOn} /></div></div>
                <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-xs leading-5 text-[var(--text-muted)]">Para cambiar un importe en el futuro, añade una nueva fecha de vigencia. Los trabajos ya cerrados conservarán su coste original.</p>
            </div>
            <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar coste</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

export default function LaborCostsPage() {
    const { user, loading: userLoading } = useUser();
    const canView = canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const canManage = canManageLaborCosts(user) && !isPlatformSuperadmin(user);
    const [rates, setRates] = React.useState<LaborCostRate[]>([]);
    const [summary, setSummary] = React.useState<LaborCostSummary[]>([]);
    const [members, setMembers] = React.useState<OrganizationMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [loadError, setLoadError] = React.useState(false);
    const [from, setFrom] = useViewState("labor.from", ""), [to, setTo] = useViewState("labor.to", ""), [search, setSearch] = useViewState("labor.search", "");
    const summaryRef = React.useRef<HTMLElement | null>(null), ratesRef = React.useRef<HTMLElement | null>(null);

    if (!userLoading && (!user || !canView)) redirect("/dashboard");

    const load = React.useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setLoadError(false);
        if (from && to && to < from) { setLoading(false); setLoadError(true); return; }
        try {
            const [nextRates, nextSummary, nextMembers] = await Promise.all([
                LaborCostService.getRates(),
                LaborCostService.getSummary(from || undefined, to || undefined),
                canManage ? OrganizationService.getMembers().catch(() => []) : Promise.resolve([]),
            ]);
            setRates(nextRates);
            setSummary(nextSummary);
            setMembers(nextMembers.filter((member) => member.status === "active" && !member.is_anonymized));
        } catch (error) {
            setLoadError(true);
            toast.error(getErrorMessage(error, "No se pudieron cargar los costes laborales."));
        } finally {
            setLoading(false);
        }
    }, [canView, canManage, from, to]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    if (userLoading || loading) {
        return <div className="flex min-h-[400px] flex-col items-center justify-center gap-3"><Loader2 className="size-8 animate-spin text-accent" /><span className="text-xs text-[var(--text-muted)]">Cargando costes laborales…</span></div>;
    }

    return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader icon={CircleDollarSign} title="Costes laborales" subtitle="Coste interno de trabajo cerrado. Esta información es confidencial y no forma parte de nóminas." actions={canManage ? <Button type="button" className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setCreating(true)}><Plus className="size-4" />Nuevo coste</Button> : undefined} />
        <section className="billing-surface flex flex-wrap items-end gap-3 rounded-xl p-3"><label className="text-xs font-medium">Desde<DatePicker aria-label="Costes desde" value={from} onValueChange={setFrom}/></label><label className="text-xs font-medium">Hasta<DatePicker aria-label="Costes hasta" value={to} onValueChange={setTo}/></label><label className="min-w-48 flex-1 text-xs font-medium">Buscar persona<Input aria-label="Buscar persona en costes" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nombre…"/></label><span className="text-xs text-muted-foreground">EUR · {from || to ? "Periodo seleccionado" : "Todo el historial"}</span></section>
        {loadError ? <FinanceLoadError message={from && to && to < from ? "La fecha final debe ser igual o posterior a la inicial." : "No se han podido consultar los costes laborales."} onRetry={() => void load()}/> : <SummaryMetricGrid desktopColumns={3}><FinanceMetricButton icon={Users} label="Tarifas registradas" value={String(rates.filter(item=>!search.trim() || (item.member_name ?? "").toLocaleLowerCase().includes(search.toLocaleLowerCase())).length)} description="Historial de vigencias · consultar tarifas" onClick={()=>ratesRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}/><FinanceMetricButton icon={CircleDollarSign} label="Coste de sesiones cerradas" value={formatCurrency(summary.filter(item=>!search.trim() || item.member_name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).reduce((sum,item)=>sum+Number(item.total_cost),0))} description="Sólo sesiones con coste configurado en el periodo" onClick={()=>summaryRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}/><FinanceMetricButton icon={Clock3} label="Sesiones con coste" value={String(summary.filter(item=>!search.trim() || item.member_name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).reduce((sum,item)=>sum+item.session_count,0))} description="Sesiones cerradas incluidas · ver resumen" onClick={()=>summaryRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}/></SummaryMetricGrid>}
        <p className="text-xs text-muted-foreground">Cobertura parcial: sólo se suman fichajes cerrados con tarifa vigente. Este resumen no permite calcular qué porcentaje de todas las horas tiene coste. Los registros de tarifa conservan sus fechas de vigencia.</p>
        <section ref={summaryRef} className="scroll-mt-4">
        <DataListTable items={loadError ? [] : summary.filter(item=>!search.trim() || item.member_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))} getRowKey={(item) => item.user_id} header={{ title: "Resumen por persona", subtitle: "Solo incluye fichajes cerrados con un coste interno vigente.", countLabel: `${summary.length} personas` }} columns={[{ key: "person", label: "Persona", className: "w-[48%]" }, { key: "sessions", label: "Sesiones", className: "w-[20%] text-right" }, { key: "cost", label: "Coste", className: "w-[32%] text-right" }]} renderDesktopRow={(item) => [<div key="person" className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><Users className="size-4" /></span><span className="truncate font-semibold text-[var(--text-main)]">{item.member_name}</span></div>, <span key="sessions" className="block text-right tabular-nums text-[var(--text-main)]">{item.session_count}</span>, <span key="cost" className="block text-right font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.total_cost))}</span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.member_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.session_count} sesiones cerradas</p></div><span className="shrink-0 font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.total_cost))}</span></div>} empty={<p className="text-sm text-[var(--text-muted)]">Aún no hay sesiones cerradas con coste interno configurado.</p>} />
        </section><section ref={ratesRef} className="scroll-mt-4">
        <DataListTable items={loadError ? [] : rates.filter(item=>!search.trim() || (item.member_name ?? "").toLocaleLowerCase().includes(search.toLocaleLowerCase()))} getRowKey={(item) => item.id} header={{ title: "Historial de costes", subtitle: "Cada cambio crea un nuevo registro de vigencia; nunca sustituye el histórico.", countLabel: `${rates.length} registros` }} columns={[{ key: "person", label: "Persona", className: "w-[42%]" }, { key: "cost", label: "Coste / hora", className: "w-[24%] text-right" }, { key: "effective", label: "Vigente desde", className: "w-[34%] text-right" }]} renderDesktopRow={(item) => [<span key="person" className="truncate font-semibold text-[var(--text-main)]">{item.member_name || "Persona eliminada"}</span>, <span key="cost" className="block text-right font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.hourly_cost))}</span>, <span key="effective" className="block text-right text-[var(--text-muted)]">{formatDate(item.effective_on)}</span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.member_name || "Persona eliminada"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Vigente desde {formatDate(item.effective_on)}</p></div><Badge variant="secondary">{formatCurrency(Number(item.hourly_cost))}/h</Badge></div>} empty={<p className="text-sm text-[var(--text-muted)]">Todavía no hay costes internos registrados.</p>} />
        </section>
        {canManage && <NewLaborCostDialog open={creating} onOpenChange={setCreating} members={members} onCreated={(rate) => { setRates((current) => [rate, ...current]); void load(); }} />}
    </div>;
}
