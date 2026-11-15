"use client";

import * as React from "react";
import { CircleDollarSign, Loader2, Plus, ShieldCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManageLaborCosts, canViewLaborCosts, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    type ReadErrorKind,
} from "@/lib/read-recovery";
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
                <div className="grid gap-2"><Label htmlFor="labor-cost-member">Persona</Label><Select value={membershipId} onValueChange={setMembershipId}><SelectTrigger id="labor-cost-member"><SelectValue placeholder="Selecciona una persona activa" /></SelectTrigger><SelectContent>{members.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.full_name || member.email}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="labor-cost-hour">Coste interno por hora</Label><Input id="labor-cost-hour" inputMode="decimal" type="number" min="0" step="0.01" value={hourlyCost} onChange={(event) => setHourlyCost(event.target.value)} placeholder="0,00" /></div><div className="grid gap-2"><Label htmlFor="labor-cost-effective">Vigente desde</Label><DatePicker id="labor-cost-effective" value={effectiveOn} onValueChange={setEffectiveOn} /></div></div>
                <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-xs leading-5 text-[var(--text-muted)]">Para cambiar un importe en el futuro, añade una nueva fecha de vigencia. Los trabajos ya cerrados conservarán su coste original.</p>
            </div>
            <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar coste</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

export default function LaborCostsPage() {
    const { user, loading: userLoading } = useUser();
    const { locale } = useDictionary();
    const canView = canViewLaborCosts(user) && !isPlatformSuperadmin(user);
    const canManage = canManageLaborCosts(user) && !isPlatformSuperadmin(user);
    const workspaceKey = getReadWorkspaceKey(user);
    const [rates, setRates] = React.useState<LaborCostRate[]>([]);
    const [summary, setSummary] = React.useState<LaborCostSummary[]>([]);
    const [members, setMembers] = React.useState<OrganizationMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creating, setCreating] = React.useState(false);
    const [errorKind, setErrorKind] = React.useState<ReadErrorKind | null>(null);
    const [loadedWorkspace, setLoadedWorkspace] = React.useState<string | null>(null);
    const requestIdRef = React.useRef(0);
    const loadedWorkspaceRef = React.useRef<string | null>(null);

    const load = React.useCallback(async () => {
        if (!canView) return;
        const requestId = ++requestIdRef.current;
        const targetWorkspace = workspaceKey;
        if (loadedWorkspaceRef.current !== targetWorkspace) {
            setRates([]);
            setSummary([]);
            setMembers([]);
            loadedWorkspaceRef.current = null;
            setLoadedWorkspace(null);
        }
        setLoading(true);
        try {
            const [nextRates, nextSummary, nextMembers] = await Promise.all([
                LaborCostService.getRates(),
                LaborCostService.getSummary(),
                canManage ? OrganizationService.getMembers() : Promise.resolve([]),
            ]);
            if (requestId !== requestIdRef.current) return;
            setRates(nextRates);
            setSummary(nextSummary);
            setMembers(nextMembers.filter((member) => member.status === "active" && !member.is_anonymized));
            loadedWorkspaceRef.current = targetWorkspace;
            setLoadedWorkspace(targetWorkspace);
            setErrorKind(null);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(error);
            setErrorKind(kind);
            if (kind === "denied" || loadedWorkspaceRef.current !== targetWorkspace) {
                setRates([]);
                setSummary([]);
                setMembers([]);
                loadedWorkspaceRef.current = null;
                setLoadedWorkspace(null);
            }
            toast.error(getErrorMessage(error, locale === "es" ? "No se pudieron cargar los costes laborales." : "Could not load labor costs."));
        } finally {
            setLoading((current) => requestId === requestIdRef.current ? false : current);
        }
    }, [canManage, canView, locale, workspaceKey]);

    const loadEvent = React.useEffectEvent(load);

    React.useEffect(() => {
        if (userLoading || !canView) return;
        const timer = window.setTimeout(() => void loadEvent(), 0);
        return () => window.clearTimeout(timer);
    }, [canManage, canView, userLoading, workspaceKey]);

    if (!userLoading && (!user || !canView)) redirect("/dashboard");

    const hasValidSnapshot = loadedWorkspace === workspaceKey && errorKind !== "denied";
    if (userLoading || (loading && !hasValidSnapshot && !errorKind)) {
        return <div className="flex min-h-[400px] flex-col items-center justify-center gap-3"><Loader2 className="size-8 animate-spin text-accent" /><span className="text-xs text-[var(--text-muted)]">Cargando costes laborales…</span></div>;
    }

    if (!canView) return null;

    const errorMessage = getReadRecoveryMessage(errorKind, locale === "es"
        ? {
            unavailable: "No se pudieron cargar los costes laborales.",
            denied: "No tienes permisos para consultar los costes laborales.",
        }
        : {
            unavailable: "Could not load labor costs.",
            denied: "You do not have permission to view labor costs.",
        });
    const retryLabel = locale === "es" ? "Reintentar" : "Retry";

    return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader icon={CircleDollarSign} title="Costes laborales" subtitle="Coste interno de trabajo cerrado. Esta información es confidencial y no forma parte de nóminas." actions={canManage && errorKind !== "denied" ? <Button type="button" className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setCreating(true)}><Plus className="size-4" />Nuevo coste</Button> : undefined} />
        {errorKind && errorMessage && (
            <ReadRecoveryBanner
                kind={errorKind}
                message={errorMessage}
                retryLabel={retryLabel}
                onRetry={errorKind === "unavailable" ? () => void load() : undefined}
                retrying={loading}
            />
        )}
        {hasValidSnapshot && (
            <>
                <div className="grid gap-4 md:grid-cols-3">
                    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><Users className="size-4 text-accent" />Personas con coste</div><p className="mt-3 text-2xl font-bold text-[var(--text-main)]">{new Set(rates.map((rate) => rate.company_membership_id)).size}</p><p className="mt-1 text-xs text-[var(--text-muted)]">con una tarifa interna registrada</p></section>
                    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><CircleDollarSign className="size-4 text-accent" />Coste acumulado</div><p className="mt-3 text-2xl font-bold text-[var(--text-main)]">{formatCurrency(summary.reduce((total, item) => total + Number(item.total_cost), 0))}</p><p className="mt-1 text-xs text-[var(--text-muted)]">de sesiones cerradas con coste configurado</p></section>
                    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><ShieldCheck className="size-4 text-accent" />Acceso protegido</div><p className="mt-3 text-sm font-semibold text-[var(--text-main)]">Solo administración</p><p className="mt-1 text-xs text-[var(--text-muted)]">Finanzas, comerciales y accesos externos no pueden verlo.</p></section>
                </div>
                <DataListTable items={summary} getRowKey={(item) => item.user_id} header={{ title: "Resumen por persona", subtitle: "Solo incluye fichajes cerrados con un coste interno vigente.", countLabel: `${summary.length} personas` }} columns={[{ key: "person", label: "Persona", className: "w-[48%]" }, { key: "sessions", label: "Sesiones", className: "w-[20%] text-right" }, { key: "cost", label: "Coste", className: "w-[32%] text-right" }]} renderDesktopRow={(item) => [<div key="person" className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-blue-soft)] text-accent"><Users className="size-4" /></span><span className="truncate font-semibold text-[var(--text-main)]">{item.member_name}</span></div>, <span key="sessions" className="block text-right tabular-nums text-[var(--text-main)]">{item.session_count}</span>, <span key="cost" className="block text-right font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.total_cost))}</span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.member_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.session_count} sesiones cerradas</p></div><span className="shrink-0 font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.total_cost))}</span></div>} empty={<p className="text-sm text-[var(--text-muted)]">Aún no hay sesiones cerradas con coste interno configurado.</p>} />
                <DataListTable items={rates} getRowKey={(item) => item.id} header={{ title: "Historial de costes", subtitle: "Cada cambio crea un nuevo registro de vigencia; nunca sustituye el histórico.", countLabel: `${rates.length} registros` }} columns={[{ key: "person", label: "Persona", className: "w-[42%]" }, { key: "cost", label: "Coste / hora", className: "w-[24%] text-right" }, { key: "effective", label: "Vigente desde", className: "w-[34%] text-right" }]} renderDesktopRow={(item) => [<span key="person" className="truncate font-semibold text-[var(--text-main)]">{item.member_name || "Persona eliminada"}</span>, <span key="cost" className="block text-right font-semibold tabular-nums text-[var(--text-main)]">{formatCurrency(Number(item.hourly_cost))}</span>, <span key="effective" className="block text-right text-[var(--text-muted)]">{formatDate(item.effective_on)}</span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.member_name || "Persona eliminada"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Vigente desde {formatDate(item.effective_on)}</p></div><Badge variant="secondary">{formatCurrency(Number(item.hourly_cost))}/h</Badge></div>} empty={<p className="text-sm text-[var(--text-muted)]">Todavía no hay costes internos registrados.</p>} />
            </>
        )}
        {canManage && <NewLaborCostDialog open={creating} onOpenChange={setCreating} members={members} onCreated={(rate) => { setRates((current) => [rate, ...current]); void load(); }} />}
    </div>;
}
