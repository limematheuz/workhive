import Link from "next/link";
import { ClientPortalAccessTab } from "@/components/clients/ClientPortalAccessTab";
import { PortalAccessStatus } from "./PortalAccessStatus";
import { Button } from "@/components/ui/button";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import type { PortalAccount } from "@/services/portal-workspace.service";
const columns: DataListColumn[] = [
    { key: "client", label: "Cliente", className: "w-[50%]" },
    { key: "access", label: "Accesos", className: "w-[25%]" },
    { key: "pending", label: "Invitaciones", className: "w-[25%]" },
];
function accessCount(account: PortalAccount) {
    return account.grants.filter(grant => grant.status === "active").length;
}
function pendingCount(account: PortalAccount) {
    return account.invitations.filter(invitation => invitation.status === "pending").length;
}
export function ClientPortalWorkspace({ accounts, selected, select, enabled, canManage, deliveryReady, offset, hasMore, move, changed }: {
    accounts: PortalAccount[];
    selected: PortalAccount | undefined;
    select: (id: number) => void;
    enabled: boolean;
    canManage: boolean;
    deliveryReady: boolean;
    offset: number;
    hasMore: boolean;
    move: (offset: number) => void;
    changed: () => void;
}) {
    return <section className="space-y-3" aria-labelledby="client-portal-title">
        <div><h2 id="client-portal-title" className="text-base font-semibold">Portal de clientes</h2><p className="mt-1 text-sm text-muted-foreground">Cada persona ve exclusivamente la información de los clientes autorizados: presupuestos enviados, contratos, facturas, controles de calidad y reclamaciones.</p></div>
        {!enabled && <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">Este módulo no está incluido en el plan actual. <Link href="/subscription" className="underline">Consultar suscripción</Link></p>}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1fr)]">
            <div className="min-w-0 rounded-2xl border bg-card">
                <DataListTable variant="plain" items={accounts} getRowKey={account => account.id} columns={columns} onRowClick={account => select(account.id)} rowAriaLabel={account => "Gestionar portal de " + account.name} renderDesktopRow={account => [
            <strong className="text-sm" key="client">{account.name}</strong>,
            <span className={accessCount(account) ? "text-sm" : "text-sm text-orange-700 dark:text-orange-300"} key="access">{accessCount(account)} activos</span>,
            <span className={pendingCount(account) ? "text-sm text-orange-700 dark:text-orange-300" : "text-sm text-muted-foreground"} key="pending">{pendingCount(account)} pendientes</span>,
        ]} renderCompactRow={account => <div className="space-y-2"><strong>{account.name}</strong><p className="text-xs text-muted-foreground">{accessCount(account)} accesos activos · {pendingCount(account)} invitaciones pendientes</p></div>}/>
                {!accounts.length && <p className="p-5 text-sm text-muted-foreground">No hay clientes en esta búsqueda. <Link className="underline" href="/dashboard/clients">Crear o gestionar clientes</Link></p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs"><span>{accounts.length ? `${offset + 1}–${offset + accounts.length}` : "0"} clientes</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!offset} onClick={() => move(Math.max(0, offset - 100))}>Anterior</Button><Button variant="outline" size="sm" disabled={!hasMore} onClick={() => move(offset + 100)}>Siguiente</Button></div></div>
            </div>
            {selected && <aside className="min-w-0 space-y-4 rounded-2xl border bg-card p-4" aria-label={"Acceso de " + selected.name}>
                <div><p className="text-xs text-muted-foreground">Cliente seleccionado</p><h3 className="mt-1 font-semibold">{selected.name}</h3></div>
                {enabled && canManage ? <><p className="text-xs text-muted-foreground">{deliveryReady ? "Crea un enlace para compartir o envía una invitación por correo." : "Crea un enlace de invitación con código y caducidad. El envío por correo estará disponible cuando se configure."}</p><ClientPortalAccessTab key={selected.id} clientId={selected.id} clientName={selected.name} onAccessChanged={changed} accessStatuses={Object.fromEntries(selected.grants.map(grant => [grant.id, grant.status]))} invitationDeliveryReady={deliveryReady}/></> : <>
                    {!canManage && <p className="text-sm text-orange-700 dark:text-orange-300">Las invitaciones y revocaciones requieren un administrador de la empresa.</p>}
                    {selected.grants.map(grant => <div key={grant.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm"><span className="break-all">{grant.name || grant.email}</span><PortalAccessStatus status={grant.status}/></div>)}
                    {!selected.grants.length && <p className="text-sm text-orange-700 dark:text-orange-300">Todavía no hay accesos configurados para este cliente.</p>}
                </>}
            </aside>}
        </div>
    </section>;
}
