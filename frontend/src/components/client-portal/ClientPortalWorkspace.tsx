"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ClipboardCheck, Download, FileCheck2, FileText, Loader2, ReceiptText, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/lib/user-context";
import { ClientPortalInspections } from "@/components/client-portal/ClientPortalInspections";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalContract, ClientPortalInvoice, ClientPortalLine, ClientPortalOverview, ClientPortalQuote, ClientPortalWorkspace as ClientPortalWorkspaceData } from "@/types/client-portal";

export type ClientPortalTab = "overview" | "quotes" | "contracts" | "invoices" | "inspections" | "profile";

const PORTAL_TABS = [
    { id: "overview" as const, label: "Resumen", icon: Building2 },
    { id: "quotes" as const, label: "Presupuestos", icon: FileText },
    { id: "contracts" as const, label: "Contratos", icon: FileCheck2 },
    { id: "invoices" as const, label: "Facturas", icon: ReceiptText },
    { id: "inspections" as const, label: "Inspecciones", icon: ClipboardCheck },
    { id: "profile" as const, label: "Perfil", icon: UserRound },
];

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

function formatDate(value?: string | null) {
    return value ? date.format(new Date(value)) : "—";
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return <Card><CardContent className="py-12 text-center"><p className="font-semibold text-[var(--text-main)]">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">{description}</p></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
    const active = ["issued", "paid", "accepted", "active"].includes(status);
    return <Badge className={active ? "border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{status}</Badge>;
}

function Lines({ lines }: { lines: ClientPortalLine[] }) {
    if (lines.length === 0) return null;
    return <div className="mt-4 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">{lines.map((line) => <div key={`${line.description}-${line.quantity}-${line.unit_price}-${line.subtotal}`} className="flex items-start justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="font-medium text-[var(--text-main)]">{line.description}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{line.quantity} × {money.format(line.unit_price)}</p></div><span className="shrink-0 font-mono font-semibold text-[var(--text-main)]">{money.format(line.subtotal)}</span></div>)}</div>;
}

function Quotes({ quotes }: { quotes: ClientPortalQuote[] }) {
    if (quotes.length === 0) return <EmptyState title="No hay presupuestos disponibles" description="Aquí aparecerán los presupuestos enviados para esta empresa." />;
    return <div className="grid gap-4 lg:grid-cols-2">{quotes.map((quote) => <Card key={quote.id}><CardContent><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-[var(--text-muted)]">{quote.quote_number}</p><h2 className="mt-1 truncate font-semibold">{quote.title}</h2></div><StatusBadge status={quote.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 border-y border-[var(--border-soft)] py-3 text-sm"><div><dt className="text-xs text-[var(--text-muted)]">Válido hasta</dt><dd className="mt-1 font-medium">{formatDate(quote.valid_until)}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Total</dt><dd className="mt-1 font-mono font-bold">{money.format(quote.total_amount)}</dd></div></dl>{quote.terms && <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{quote.terms}</p>}<Lines lines={quote.lines} /></CardContent></Card>)}</div>;
}

function Contracts({ contracts }: { contracts: ClientPortalContract[] }) {
    if (contracts.length === 0) return <EmptyState title="No hay contratos activos" description="Los contratos activos o finalizados de esta empresa se mostrarán aquí." />;
    return <div className="space-y-4">{contracts.map((contract) => <Card key={contract.id}><CardContent><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-mono text-xs text-[var(--text-muted)]">{contract.contract_number}</p><h2 className="mt-1 font-semibold">{contract.title}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{formatDate(contract.starts_at)} — {formatDate(contract.ends_at)}</p></div><StatusBadge status={contract.status} /></div><div className="mt-4 grid gap-3 border-y border-[var(--border-soft)] py-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-[var(--text-muted)]">Renovación</p><p className="mt-1 font-medium">{contract.renewal_mode === "automatic" ? "Automática" : "Manual"}</p></div><div><p className="text-xs text-[var(--text-muted)]">Aviso</p><p className="mt-1 font-medium">{contract.renewal_notice_days} días</p></div>{contract.service_window && <div><p className="text-xs text-[var(--text-muted)]">Horario</p><p className="mt-1 font-medium">{contract.service_window}</p></div>}</div><Lines lines={contract.lines} />{contract.covered_locations.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ubicaciones cubiertas</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{contract.covered_locations.map((location) => <div key={`${location.location_name}-${location.covered_from}-${location.covered_until}-${location.zone_names.join("-")}`} className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2 text-sm"><p className="font-medium">{location.location_name || "Ubicación"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(location.covered_from)} — {formatDate(location.covered_until)}{location.zone_names.length ? ` · ${location.zone_names.join(", ")}` : ""}</p></div>)}</div></div>}</CardContent></Card>)}</div>;
}

function Invoices({ invoices, workspaceId }: { invoices: ClientPortalInvoice[]; workspaceId: number }) {
    const [downloading, setDownloading] = useState<number | null>(null);
    const download = async (invoice: ClientPortalInvoice) => {
        try {
            setDownloading(invoice.id);
            const blob = await ClientPortalService.downloadInvoice(workspaceId, invoice.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${invoice.invoice_number}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo descargar la factura.");
        } finally {
            setDownloading(null);
        }
    };
    if (invoices.length === 0) return <EmptyState title="No hay facturas disponibles" description="Las facturas emitidas para esta empresa aparecerán aquí." />;
    return <div className="space-y-4">{invoices.map((invoice) => <Card key={invoice.id}><CardContent><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs text-[var(--text-muted)]">{invoice.invoice_number}</p><StatusBadge status={invoice.status} />{invoice.is_rectification && <Badge variant="secondary" className="text-[10px] uppercase">Rectificativa</Badge>}</div><p className="mt-2 text-sm text-[var(--text-muted)]">Emitida el {formatDate(invoice.issue_date)} · Vence {formatDate(invoice.due_date)}</p></div><div className="flex shrink-0 items-center gap-3"><p className="font-mono text-lg font-bold">{money.format(invoice.total_amount)}</p><Button type="button" variant="outline" size="sm" disabled={downloading === invoice.id} onClick={() => void download(invoice)}><Download className="size-4" />{downloading === invoice.id ? "Descargando…" : "PDF"}</Button></div></div><Lines lines={invoice.lines} /></CardContent></Card>)}</div>;
}

export function ClientPortalWorkspace({ initialTab }: { initialTab: ClientPortalTab }) {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<ClientPortalTab>(initialTab);
    const [workspaces, setWorkspaces] = useState<ClientPortalWorkspaceData[]>([]);
    const [workspaceId, setWorkspaceId] = useState<number | null>(null);
    const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const loadStarted = useRef(false);

    const load = useCallback(async (requestedWorkspaceId?: number) => {
        setLoading(true);
        setError(null);
        try {
            const nextWorkspaces = await ClientPortalService.getWorkspaces();
            setWorkspaces(nextWorkspaces);
            const selectedId = requestedWorkspaceId ?? workspaceId ?? nextWorkspaces[0]?.id ?? null;
            if (selectedId == null || !nextWorkspaces.some((workspace) => workspace.id === selectedId)) {
                setWorkspaceId(null);
                setOverview(null);
                return;
            }
            setWorkspaceId(selectedId);
            setOverview(await ClientPortalService.getOverview(selectedId));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo abrir el portal.");
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (loadStarted.current) return;
        loadStarted.current = true;
        void load();
    }, [load]);

    const currentWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === workspaceId) ?? overview?.workspace ?? null, [overview?.workspace, workspaceId, workspaces]);
    const changeWorkspace = (value: string) => void load(Number(value));

    if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin text-accent" /><span className="sr-only">Cargando portal de cliente</span></div>;
    if (error) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No se pudo abrir el portal" description={error} /><div className="mt-4 text-center"><Button type="button" variant="outline" onClick={() => void load()}>Reintentar</Button></div></div>;
    if (!currentWorkspace || !overview || workspaceId == null) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No tienes accesos activos" description="Pide a tu proveedor que te invite al portal documental de tu empresa." /></div>;

    return <div className="mx-auto max-w-6xl space-y-5 px-[3%] py-6 pb-12 md:p-8">
        <header className="billing-surface billing-surface-accent-pad rounded-[24px]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Portal de cliente</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{currentWorkspace.client_name}</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Documentos comerciales y revisiones de calidad emitidos por {currentWorkspace.company_name}.</p></div>{workspaces.length > 1 && <div className="w-full sm:w-72"><Select value={String(workspaceId)} onValueChange={changeWorkspace}><SelectTrigger aria-label="Seleccionar empresa" className="bg-[var(--bg-primary)]/65"><SelectValue /></SelectTrigger><SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.company_name} · {workspace.client_name}</SelectItem>)}</SelectContent></Select></div>}</div></header>
        <PremiumTabs tabs={PORTAL_TABS} activeTab={activeTab} onChange={setActiveTab} mobileLabel="Sección del portal" />
        {activeTab === "overview" && <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent><FileText className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Presupuestos</p><p className="mt-1 text-3xl font-bold">{overview.quotes.length}</p></CardContent></Card><Card><CardContent><FileCheck2 className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Contratos</p><p className="mt-1 text-3xl font-bold">{overview.contracts.length}</p></CardContent></Card><Card><CardContent><ReceiptText className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Facturas</p><p className="mt-1 text-3xl font-bold">{overview.invoices.length}</p></CardContent></Card><Card><CardContent><ClipboardCheck className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Inspecciones</p><p className="mt-1 text-3xl font-bold">{overview.inspections.length}</p></CardContent></Card></div><Card><CardContent><h2 className="font-semibold">Acceso documental y de calidad</h2><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Solo ves los presupuestos enviados, contratos, facturas e inspecciones cerradas de {currentWorkspace.client_name}. Este portal no da acceso al espacio de trabajo ni a información de otros clientes.</p></CardContent></Card></section>}
        {activeTab === "quotes" && <Quotes quotes={overview.quotes} />}
        {activeTab === "contracts" && <Contracts contracts={overview.contracts} />}
        {activeTab === "invoices" && <Invoices invoices={overview.invoices} workspaceId={workspaceId} />}
        {activeTab === "inspections" && <ClientPortalInspections inspections={overview.inspections} workspaceId={workspaceId} defaultSignerName={user?.full_name || ""} onAccepted={(inspection) => setOverview((current) => current ? { ...current, inspections: current.inspections.map((item) => item.id === inspection.id ? inspection : item) } : current)} />}
        {activeTab === "profile" && <Card><CardContent className="space-y-4"><div className="flex items-center gap-3"><UserRound className="size-8 text-accent" /><div><h2 className="font-semibold">{user?.full_name || "Usuario"}</h2><p className="text-sm text-[var(--text-muted)]">{user?.email}</p></div></div><p className="border-t border-[var(--border-soft)] pt-4 text-sm leading-6 text-[var(--text-muted)]">Este acceso es revocable por {currentWorkspace.company_name}. Si necesitas añadir otra empresa, solicita una invitación al administrador de esa empresa.</p></CardContent></Card>}
    </div>;
}
