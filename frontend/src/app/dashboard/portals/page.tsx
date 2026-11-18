"use client";
import { useCallback, useState } from "react";
import { Globe2, Landmark, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientPortalWorkspace } from "@/components/portals/ClientPortalWorkspace";
import { AdviserPortalWorkspace } from "@/components/portals/AdviserPortalWorkspace";
import { ApplicationEntryCards } from "@/components/portals/ApplicationEntryCards";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useUser } from "@/lib/user-context";
import { readPortalWorkspace, type PortalWorkspace } from "@/services/portal-workspace.service";
export default function PortalsPage() {
    const { user, loading } = useUser();
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [error, setError] = useState("");
    const key = `${user?.company_id}:${user?.id}:${query}:${offset}:${revision}`;
    const [result, setResult] = useState<{
        key: string;
        data: PortalWorkspace;
    } | null>(null);
    const request = useCallback(() => readPortalWorkspace(query, offset), [query, offset]);
    const receive = useCallback((data: PortalWorkspace) => { setResult({ key, data }); setError(""); }, [key]);
    const failed = useCallback((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los portales."), []);
    useResourceEffect(Boolean(user), key, request, receive, failed);
    const data = result?.key === key ? result.data : null;
    const account = data?.clients.find(client => client.id === selected) ?? data?.clients[0];
    const refresh = () => { setError(""); setRevision(value => value + 1); };
    if (loading)
        return <p>Cargando…</p>;
    return <div className="dashboard-page-content space-y-4">
        <PageHeader icon={Globe2} title="Portales y aplicaciones" subtitle="Entradas para clientes, gestorías y trabajadores; autorizaciones de tu empresa." actions={<Button variant="outline" onClick={refresh}><RefreshCw className="size-4"/>Actualizar</Button>}/>
        {error && <p role="alert" className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{error}</p>}
        {!data && !error && <p role="status" className="text-sm text-muted-foreground">Cargando accesos y autorizaciones…</p>}
        {data && <>
            <ApplicationEntryCards modules={data.modules} />
            <SummaryMetricGrid desktopColumns={3} aria-label="Accesos externos de la empresa">
                <SummaryMetricCard icon={ShieldCheck} label="Accesos de clientes activos" value={String(data.summary.active_client_accesses)} description="Autorizaciones vigentes"/>
                <SummaryMetricCard icon={Mail} label="Invitaciones pendientes" value={String(data.summary.pending_invitations)} description="Enviadas y aún sin aceptar"/>
                <SummaryMetricCard icon={Landmark} label="Accesos de gestoría activos" value={String(data.advisers.filter(adviser => adviser.status === "active").length)} description="Áreas contables o laborales autorizadas"/>
            </SummaryMetricGrid>
            <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3" onSubmit={event => { event.preventDefault(); setOffset(0); setQuery(search.trim()); }}>
                <label className="min-w-48 flex-1 text-sm">Buscar cliente<Input type="search" placeholder="Nombre del cliente" value={search} onChange={event => setSearch(event.target.value)}/></label><Button variant="outline">Buscar</Button>
            </form>
            <ClientPortalWorkspace accounts={data.clients} selected={account} select={setSelected} enabled={data.modules.client_portal} canManage={data.can_manage_client_invitations} deliveryReady={data.invitation_delivery_configured} offset={offset} hasMore={data.has_more} move={setOffset} changed={refresh}/>
            <AdviserPortalWorkspace advisers={data.advisers} enabled={data.modules.advisory}/>
        </>}
    </div>;
}
