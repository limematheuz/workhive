"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ClipboardCheck, ClipboardList, FileCheck2, FileText, Loader2, MessageSquareWarning, ReceiptText, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
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
    return <Badge className={active ? "border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wide text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}>{status}</Badge>;
}

function Contracts({ contracts }: { contracts: ClientPortalContract[] }) {
    if (contracts.length === 0) return <EmptyState title="No hay contratos activos" description="Los contratos activos o finalizados de esta empresa se mostrarán aquí." />;
    return <div className="space-y-4">{contracts.map((contract) => <Card key={contract.id}><CardContent><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-mono text-xs text-[var(--text-muted)]">{contract.contract_number}</p><h2 className="mt-1 font-semibold">{contract.title}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{formatDate(contract.starts_at)} — {formatDate(contract.ends_at)}</p></div><StatusBadge status={contract.status} /></div><div className="mt-4 grid gap-3 border-y border-[var(--border-soft)] py-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-[var(--text-muted)]">Renovación</p><p className="mt-1 font-medium">{contract.renewal_mode === "automatic" ? "Automática" : "Manual"}</p></div><div><p className="text-xs text-[var(--text-muted)]">Aviso</p><p className="mt-1 font-medium">{contract.renewal_notice_days} días</p></div>{contract.service_window && <div><p className="text-xs text-[var(--text-muted)]">Horario</p><p className="mt-1 font-medium">{contract.service_window}</p></div>}</div><Lines lines={contract.lines} />{contract.covered_locations.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ubicaciones cubiertas</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{contract.covered_locations.map((location) => <div key={`${location.location_name}-${location.covered_from}-${location.covered_until}-${location.zone_names.join("-")}`} className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2 text-sm"><p className="font-medium">{location.location_name || "Ubicación"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(location.covered_from)} — {formatDate(location.covered_until)}{location.zone_names.length ? ` · ${location.zone_names.join(", ")}` : ""}</p></div>)}</div></div>}</CardContent></Card>)}</div>;
}

export function ClientPortalWorkspace({ initialTab }: { initialTab: ClientPortalTab }) {
    const { user, loading: userLoading } = useUser();
    const workspaceKey = getReadWorkspaceKey(user);
    const [activeTab, setActiveTab] = useState<ClientPortalTab>(initialTab);
    const [workspaces, setWorkspaces] = useState<ClientPortalWorkspaceData[]>([]);
    const [workspaceId, setWorkspaceId] = useState<number | null>(null);
    const [overview, setOverview] = useState<ClientPortalOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [errorKind, setErrorKind] = useState<ReadErrorKind | null>(null);
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const workspaceIdRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const loadedWorkspaceRef = useRef<string | null>(null);

    const load = useCallback(async (requestedWorkspaceId?: number, isRetry = false) => {
        const requestId = ++requestIdRef.current;
        const workspaceChanged = loadedWorkspaceRef.current !== workspaceKey;
        loadedWorkspaceRef.current = workspaceKey;
        if (workspaceChanged) {
            workspaceIdRef.current = null;
            setWorkspaces([]);
            setWorkspaceId(null);
            setOverview(null);
            setErrorKind(null);
            setErrorDetail(null);
            setLoading(true);
        } else if (isRetry) {
            setRetrying(true);
        } else {
            setLoading(true);
        }
        setErrorKind(null);
        setErrorDetail(null);
        try {
            const nextWorkspaces = await ClientPortalService.getWorkspaces();
            if (requestId !== requestIdRef.current) return;
            setWorkspaces(nextWorkspaces);
            const preferredId = requestedWorkspaceId ?? workspaceIdRef.current;
            const selectedId = nextWorkspaces.some((workspace) => workspace.id === preferredId)
                ? preferredId
                : nextWorkspaces[0]?.id ?? null;
            if (selectedId == null) {
                workspaceIdRef.current = null;
                setWorkspaceId(null);
                setOverview(null);
                return;
            }
            workspaceIdRef.current = selectedId;
            setWorkspaceId(selectedId);
            const nextOverview = await ClientPortalService.getOverview(selectedId);
            if (requestId !== requestIdRef.current) return;
            setOverview(nextOverview);
        } catch (cause) {
            if (requestId !== requestIdRef.current) return;
            const kind = classifyReadError(cause);
            setErrorKind(kind);
            setErrorDetail(cause instanceof Error ? cause.message : null);
            if (kind === "denied") {
                workspaceIdRef.current = null;
                setWorkspaces([]);
                setWorkspaceId(null);
                setOverview(null);
            }
        } finally {
            setLoading((current) => requestId === requestIdRef.current ? false : current);
            setRetrying((current) => requestId === requestIdRef.current ? false : current);
        }
    }, [workspaceKey]);

    useEffect(() => {
        if (userLoading) return;
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load, userLoading]);

    const currentWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === workspaceId) ?? overview?.workspace ?? null, [overview?.workspace, workspaceId, workspaces]);
    const changeWorkspace = (value: string) => void load(Number(value));

    if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin text-accent" /><span className="sr-only">Cargando portal de cliente</span></div>;
    const errorMessage = getReadRecoveryMessage(errorKind, {
        unavailable: errorDetail || "No se pudo abrir el portal ahora mismo.",
        denied: errorDetail || "Tu acceso al portal de cliente ya no está disponible.",
    });
    if (errorKind && errorMessage && (!currentWorkspace || !overview || workspaceId == null)) {
        return (
            <div className="mx-auto max-w-xl px-[3%] py-8">
                <ReadRecoveryBanner
                    kind={errorKind}
                    message={errorMessage}
                    retryLabel="Reintentar"
                    onRetry={shouldShowReadRetry(errorKind) ? () => void load(workspaceId ?? undefined, true) : undefined}
                    retrying={retrying}
                />
            </div>
        );
    }
    if (!currentWorkspace || !overview || workspaceId == null) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No tienes accesos activos" description="Pide a tu proveedor que te invite al portal documental de tu empresa." /></div>;

    return <div className="mx-auto max-w-6xl space-y-5 px-[3%] py-6 pb-12 md:p-8">
        {errorKind && errorMessage && (
            <ReadRecoveryBanner
                kind={errorKind}
                message={errorMessage}
                retryLabel="Reintentar"
                onRetry={shouldShowReadRetry(errorKind) ? () => void load(workspaceId, true) : undefined}
                retrying={retrying}
            />
        )}
        <header className="billing-surface billing-surface-accent-pad rounded-[24px]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Portal de cliente</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{currentWorkspace.client_name}</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Documentos comerciales, calidad y reclamaciones emitidos por {currentWorkspace.company_name}.</p></div>{workspaces.length > 1 && <div className="w-full sm:w-72"><SearchableSelect aria-label="Seleccionar empresa del portal" value={String(workspaceId)} onValueChange={changeWorkspace} options={workspaces.map(workspace => ({ value: String(workspace.id), label: workspace.company_name, description: workspace.client_name }))} /></div>}</div></header>
        <PremiumTabs tabs={PORTAL_TABS} activeTab={activeTab} onChange={setActiveTab} mobileLabel="Sección del portal" />
        {activeTab === "overview" && <ClientPortalOverviewSummary overview={overview} clientName={currentWorkspace.client_name} />}
        {activeTab === "services" && <ClientPortalServiceParts key={workspaceId} workspaceId={workspaceId} defaultSignerName={user?.full_name || ""} />}
        {activeTab === "documents" && <ClientPortalDocuments key={workspaceId} workspaceId={workspaceId} signerName={user?.full_name ?? ""} />}
        {activeTab === "quotes" && <ClientPortalQuotes quotes={overview.quotes} workspaceId={workspaceId} refresh={() => void load(workspaceId)} onAccepted={quote => setOverview(current => current ? { ...current, quotes: current.quotes.map(item => item.id === quote.id ? quote : item) } : current)} />}
        {activeTab === "contracts" && <Contracts contracts={overview.contracts} />}
        {activeTab === "invoices" && <ClientPortalInvoices invoices={overview.invoices} workspaceId={workspaceId} />}
        {activeTab === "inspections" && <ClientPortalInspections inspections={overview.inspections} workspaceId={workspaceId} defaultSignerName={user?.full_name || ""} onAccepted={(inspection) => setOverview((current) => current ? { ...current, inspections: current.inspections.map((item) => item.id === inspection.id ? inspection : item) } : current)} />}
        {activeTab === "complaints" && <ClientPortalComplaints complaints={overview.complaints} locations={overview.complaint_locations} workspaceId={workspaceId} onCreated={(complaint) => setOverview((current) => current ? { ...current, complaints: [complaint, ...current.complaints] } : current)} />}
        {activeTab === "profile" && <Card><CardContent className="space-y-4"><div className="flex items-center gap-3"><UserRound className="size-8 text-accent" /><div><h2 className="font-semibold">{user?.full_name || "Usuario"}</h2><p className="text-sm text-[var(--text-muted)]">{user?.email}</p></div></div><p className="border-t border-[var(--border-soft)] pt-4 text-sm leading-6 text-[var(--text-muted)]">Este acceso es revocable por {currentWorkspace.company_name}. Si necesitas añadir otra empresa, solicita una invitación al administrador de esa empresa.</p></CardContent></Card>}
    </div>;
}
