"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ClipboardCheck, ClipboardList, FileCheck2, FileText, Loader2, MessageSquareWarning, ReceiptText, RefreshCw, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { ApiResponseError } from "@/lib/api";
import { clientQuoteNeedsDecision, portalComplaintUnresolved, portalTextMatches, type ClientPortalAttention } from "@/lib/portal-attention";
import { useUser } from "@/lib/user-context";
import { ClientPortalOverviewSummary } from "@/components/client-portal/ClientPortalOverviewSummary";
import { ClientPortalInspections } from "@/components/client-portal/ClientPortalInspections";
import { ClientPortalComplaints } from "@/components/client-portal/ClientPortalComplaints";
import { ClientPortalQuotes } from "./ClientPortalQuotes";
import { ClientPortalInvoices } from "./ClientPortalInvoices";
import { ClientPortalServiceParts } from "./ClientPortalServiceParts";
import { ClientPortalDocuments } from "./ClientPortalDocuments";
import { ClientPortalDocumentLines as Lines } from "./ClientPortalDocumentLines";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalContract, ClientPortalOverview, ClientPortalWorkspace as ClientPortalWorkspaceData } from "@/types/client-portal";

export type ClientPortalTab = "overview" | "services" | "documents" | "quotes" | "contracts" | "invoices" | "inspections" | "complaints" | "profile";

const PORTAL_TABS = [
    { id: "overview" as const, label: "Resumen", icon: Building2 },
    { id: "services" as const, label: "Servicios y partes", icon: ClipboardList },
    { id: "documents" as const, label: "Documentación", icon: FileText },
    { id: "quotes" as const, label: "Presupuestos", icon: FileText },
    { id: "contracts" as const, label: "Contratos", icon: FileCheck2 },
    { id: "invoices" as const, label: "Facturas", icon: ReceiptText },
    { id: "inspections" as const, label: "Inspecciones", icon: ClipboardCheck },
    { id: "complaints" as const, label: "Reclamaciones", icon: MessageSquareWarning },
    { id: "profile" as const, label: "Perfil", icon: UserRound },
];

const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

function formatDate(value?: string | null) {
    return value ? date.format(new Date(value)) : "—";
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return <Card><CardContent className="py-12 text-center"><p className="font-semibold text-[var(--text-main)]">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">{description}</p></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
    const active = ["issued", "paid", "accepted", "active"].includes(status);
    const labels: Record<string,string> = {issued:"Emitido",paid:"Pagado",accepted:"Aceptado",active:"Activo",terminated:"Finalizado",expired:"Caducado"};
    return <Badge className={active ? "border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{labels[status] ?? status}</Badge>;
}

function Contracts({ contracts }: { contracts: ClientPortalContract[] }) {
    if (contracts.length === 0) return <EmptyState title="No hay contratos activos" description="Los contratos activos o finalizados de esta empresa se mostrarán aquí." />;
    return <div className="space-y-4">{contracts.map((contract) => <Card key={contract.id}><CardContent><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-mono text-xs text-[var(--text-muted)]">{contract.contract_number}</p><h2 className="mt-1 font-semibold">{contract.title}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{formatDate(contract.starts_at)} — {formatDate(contract.ends_at)}</p></div><StatusBadge status={contract.status} /></div><div className="mt-4 grid gap-3 border-y border-[var(--border-soft)] py-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-[var(--text-muted)]">Renovación</p><p className="mt-1 font-medium">{contract.renewal_mode === "automatic" ? "Automática" : "Manual"}</p></div><div><p className="text-xs text-[var(--text-muted)]">Aviso</p><p className="mt-1 font-medium">{contract.renewal_notice_days} días</p></div>{contract.service_window && <div><p className="text-xs text-[var(--text-muted)]">Horario</p><p className="mt-1 font-medium">{contract.service_window}</p></div>}</div><Lines lines={contract.lines} />{contract.covered_locations.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ubicaciones cubiertas</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{contract.covered_locations.map((location) => <div key={`${location.location_name}-${location.covered_from}-${location.covered_until}-${location.zone_names.join("-")}`} className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2 text-sm"><p className="font-medium">{location.location_name || "Ubicación"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(location.covered_from)} — {formatDate(location.covered_until)}{location.zone_names.length ? ` · ${location.zone_names.join(", ")}` : ""}</p></div>)}</div></div>}</CardContent></Card>)}</div>;
}

export function ClientPortalWorkspace({ initialTab }: { initialTab: ClientPortalTab }) {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<ClientPortalTab>(initialTab);
    const [workspaces, setWorkspaces] = useState<ClientPortalWorkspaceData[]>([]);
    const [workspaceId, setWorkspaceId] = useState<number | null>(null);
    const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [attention, setAttention] = useState<ClientPortalAttention>("all");
    const loadStarted = useRef(false);
    const requestVersion = useRef(0);

    const load = useCallback(async (requestedWorkspaceId?: number) => {
        const version = ++requestVersion.current;
        setLoading(true);
        setError(null);
        try {
            const nextWorkspaces = await ClientPortalService.getWorkspaces();
            if (version !== requestVersion.current) return;
            const preferredId = requestedWorkspaceId ?? workspaceId;
            const selectedId = nextWorkspaces.some(workspace => workspace.id === preferredId) ? preferredId : nextWorkspaces[0]?.id ?? null;
            if (selectedId == null) {
                setWorkspaces(nextWorkspaces);
                setWorkspaceId(null);
                setOverview(null);
                return;
            }
            const nextOverview = await ClientPortalService.getOverview(selectedId);
            if (version !== requestVersion.current) return;
            setWorkspaces(nextWorkspaces);
            setWorkspaceId(selectedId);
            setOverview(nextOverview);
            if (selectedId !== workspaceId) { setSearch(""); setAttention("all"); }
        } catch (cause) {
            if (version !== requestVersion.current) return;
            if (cause instanceof ApiResponseError && [401, 403, 404].includes(cause.status)) setOverview(null);
            setError(cause instanceof Error ? cause.message : "No se pudo abrir el portal.");
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (loadStarted.current) return;
        loadStarted.current = true;
        void load();
    }, [load]);

    const currentWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === workspaceId) ?? overview?.workspace ?? null, [overview?.workspace, workspaceId, workspaces]);
    const changeWorkspace = (value: string) => void load(Number(value));

    if (loading && !overview) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin text-accent" /><span className="sr-only">Cargando portal de cliente</span></div>;
    if (error && !overview) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No se pudo abrir el portal" description={error} /><div className="mt-4 text-center"><Button type="button" variant="outline" onClick={() => void load()}>Reintentar</Button></div></div>;
    if (!currentWorkspace || !overview || workspaceId == null) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No tienes accesos activos" description="Pide a tu proveedor que te invite al portal documental de tu empresa." /></div>;
    const visibleQuotes = overview.quotes.filter((quote) => (attention !== "respond" || clientQuoteNeedsDecision(quote)) && portalTextMatches(search, [quote.quote_number, quote.title]));
    const visibleInvoices = overview.invoices.filter((invoice) => portalTextMatches(search, [invoice.invoice_number]));
    const visibleInspections = overview.inspections.filter((inspection) => (attention !== "validate" || !inspection.acceptance) && portalTextMatches(search, [inspection.template_title, inspection.location_name]));
    const visibleComplaints = overview.complaints.filter((complaint) => (attention !== "unresolved" || portalComplaintUnresolved(complaint)) && portalTextMatches(search, [complaint.title, complaint.location_name, complaint.description, complaint.customer_response]));
    const visibleContracts = overview.contracts.filter((contract) => portalTextMatches(search, [contract.contract_number, contract.title]));

    return <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 pb-12 md:px-6">
        <PageHeader icon={Building2} title={currentWorkspace.client_name} subtitle={`Empresa proveedora: ${currentWorkspace.company_name} · Cliente: ${currentWorkspace.client_name}`} actions={<Button variant="outline" size="sm" disabled={loading} onClick={() => void load(workspaceId)}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Actualizar</Button>} />
        {workspaces.length > 1 && <section className="billing-surface rounded-xl border p-4"><label className="mb-2 block text-sm font-medium" htmlFor="client-portal-workspace">Empresa autorizada</label><SearchableSelect id="client-portal-workspace" disabled={loading} aria-label="Seleccionar empresa del portal" value={String(workspaceId)} onValueChange={changeWorkspace} options={workspaces.map(workspace => ({ value: String(workspace.id), label: workspace.company_name, description: workspace.client_name }))} /></section>}
        {error && <div role="alert" className="rounded-xl border border-orange-400/30 p-3 text-sm">{error} · Se conserva la última consulta.</div>}
        <PremiumTabs tabs={PORTAL_TABS} activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setAttention("all"); setSearch(""); }} mobileLabel="Sección del portal" />
        {["quotes", "invoices", "contracts", "inspections", "complaints"].includes(activeTab) && <div className="flex flex-wrap items-center gap-2"><Input aria-label="Buscar en los documentos del portal" placeholder="Referencia, título o ubicación…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-48 flex-1" />{(attention !== "all" || search) && <Button variant="outline" size="sm" onClick={() => { setAttention("all"); setSearch(""); }}>Mostrar todos</Button>}{attention !== "all" && <p className="w-full text-xs text-orange-700 dark:text-orange-300">{attention === "respond" ? "Presupuestos pendientes de tu decisión" : attention === "validate" ? "Inspecciones pendientes de tu validación" : "Reclamaciones sin resolver"}</p>}</div>}
        {activeTab === "overview" && <ClientPortalOverviewSummary overview={overview} clientName={currentWorkspace.client_name} onNavigate={(tab, next) => { setActiveTab(tab); setAttention(next); setSearch(""); }} />}
        {activeTab === "services" && <ClientPortalServiceParts key={workspaceId} workspaceId={workspaceId} defaultSignerName={user?.full_name || ""} />}
        {activeTab === "documents" && <ClientPortalDocuments key={workspaceId} workspaceId={workspaceId} signerName={user?.full_name ?? ""} />}
        {activeTab === "quotes" && <ClientPortalQuotes quotes={visibleQuotes} filtered={Boolean(search || attention !== "all")} workspaceId={workspaceId} refresh={() => void load(workspaceId)} onAccepted={quote => setOverview(current => current ? { ...current, quotes: current.quotes.map(item => item.id === quote.id ? quote : item) } : current)} />}
        {activeTab === "contracts" && <Contracts contracts={visibleContracts} />}
        {activeTab === "invoices" && <ClientPortalInvoices invoices={visibleInvoices} filtered={Boolean(search)} workspaceId={workspaceId} />}
        {activeTab === "inspections" && <ClientPortalInspections inspections={visibleInspections} filtered={Boolean(search || attention !== "all")} workspaceId={workspaceId} defaultSignerName={user?.full_name || ""} onAccepted={(inspection) => setOverview((current) => current ? { ...current, inspections: current.inspections.map((item) => item.id === inspection.id ? inspection : item) } : current)} />}
        {activeTab === "complaints" && <ClientPortalComplaints complaints={visibleComplaints} filtered={Boolean(search || attention !== "all")} locations={overview.complaint_locations} workspaceId={workspaceId} onCreated={(complaint) => setOverview((current) => current ? { ...current, complaints: [complaint, ...current.complaints] } : current)} />}
        {activeTab === "profile" && <Card><CardContent className="space-y-4"><div className="flex items-center gap-3"><UserRound className="size-8 text-accent" /><div><h2 className="font-semibold">{user?.full_name || "Usuario"}</h2><p className="text-sm text-[var(--text-muted)]">{user?.email}</p></div></div><p className="border-t border-[var(--border-soft)] pt-4 text-sm leading-6 text-[var(--text-muted)]">Este acceso es revocable por {currentWorkspace.company_name}. Si necesitas añadir otra empresa, solicita una invitación al administrador de esa empresa.</p></CardContent></Card>}
    </div>;
}
