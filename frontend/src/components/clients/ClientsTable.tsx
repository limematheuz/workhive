"use client";

import {
    Building2,
    CircleCheck,
    Eye,
    ListChecks,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Power,
    Trash2,
    UserRound,
    Users,
} from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import type { Client } from "@/services/client.service";

type ClientsTableProps = {
    rows: ClientWorkspaceRow[];
    financialDataAvailable: boolean;
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
    onToggleActive: (client: Client) => void;
    onDetails: (client: Client) => void;
};

function ClientIdentity({ row }: { row: ClientWorkspaceRow }) {
    const Icon = row.client.client_type === "individual" ? UserRound : Building2;
    return (
        <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-main)]">{row.client.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">{row.client.legal_number || "Sin NIF/CIF"}</p>
            </div>
        </div>
    );
}

export function ClientsTable({
    rows,
    financialDataAvailable,
    onEdit,
    onDelete,
    onToggleActive,
    onDetails,
}: ClientsTableProps) {
    const { dict } = useDictionary();
    const { user } = useUser();
    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";
    const gridClassName = financialDataAvailable
        ? isReadOnly
            ? "grid-cols-[minmax(13rem,1.35fr)_6.75rem_minmax(11rem,1fr)_6rem_4.5rem_5.5rem_7.5rem_7.5rem_5.5rem]"
            : "grid-cols-[minmax(13rem,1.35fr)_6.75rem_minmax(11rem,1fr)_6rem_4.5rem_5.5rem_7.5rem_7.5rem_5.5rem_2.25rem]"
        : isReadOnly
            ? "grid-cols-[minmax(14rem,1.5fr)_7rem_minmax(11rem,1fr)_6rem_5rem_6rem_5.5rem]"
            : "grid-cols-[minmax(14rem,1.5fr)_7rem_minmax(11rem,1fr)_6rem_5rem_6rem_5.5rem_2.25rem]";

    const statusBadge = (client: Client) => (
        <Badge
            variant={client.is_active ? "default" : "secondary"}
            className={client.is_active
                ? "border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-700"
                : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] font-semibold text-[var(--text-muted)]"}
        >
            {client.is_active && <CircleCheck className="mr-1 h-3 w-3" aria-hidden="true" />}
            {client.is_active ? dict.clients.table.active : dict.clients.table.inactive}
        </Badge>
    );

    const typeBadge = (client: Client) => {
        const label = client.client_type === "business"
            ? dict.clients.table.company
            : client.client_type === "company"
                ? dict.clients.table.collaborator
                : dict.clients.table.individual;
        return <Badge className="border border-accent/20 bg-accent/10 text-[10px] font-semibold text-accent">{label}</Badge>;
    };

    const renderActions = (client: Client) => (
        <ActionPopover
            align="end"
            triggerLabel={`Acciones para ${client.name}`}
            options={[
                { label: "Ver detalle", icon: Eye, onClick: () => onDetails(client) },
                ...(!isReadOnly ? [
                    { label: dict.clients.table.edit, icon: Pencil, onClick: () => onEdit(client), variant: "edit" as const },
                    { label: client.is_active ? "Desactivar" : "Activar", icon: Power, onClick: () => onToggleActive(client), variant: "deactivate" as const },
                    { label: dict.clients.table.delete, icon: Trash2, onClick: () => onDelete(client), variant: "delete" as const },
                ] : []),
            ]}
        />
    );

    return (
        <DataListTable
            items={rows}
            getRowKey={(row) => row.client.id}
            gridClassName={gridClassName}
            desktopFrom="lg"
            onRowClick={(row) => onDetails(row.client)}
            rowAriaLabel={(row) => `Ver detalle de ${row.client.name}`}
            header={{
                title: "Clientes registrados",
                subtitle: "Pulsa una fila para abrir el resumen del cliente.",
                countLabel: `${rows.length} ${rows.length === 1 ? "cliente" : "clientes"}`,
            }}
            columns={[
                { key: "client", label: "Cliente" },
                { key: "type", label: "Tipo" },
                { key: "contact", label: "Contacto principal" },
                { key: "phone", label: "Teléfono" },
                { key: "locations", label: "Ubicaciones", className: "text-right" },
                { key: "jobs", label: "Trabajos", className: "text-right" },
                ...(financialDataAvailable ? [
                    { key: "billing", label: "Facturación", className: "text-right" },
                    { key: "balance", label: "Saldo pendiente", className: "text-right" },
                ] : []),
                { key: "status", label: "Estado" },
                { key: "activity", label: "Última actividad" },
                ...(!isReadOnly ? [{ key: "actions", label: <span className="sr-only">Acciones</span>, className: "text-right" }] : []),
            ]}
            empty={(
                <>
                    <Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <h2 className="mt-3 text-sm font-semibold text-[var(--text-main)]">No hay clientes que mostrar</h2>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">Prueba a cambiar los filtros o crea un cliente nuevo.</p>
                </>
            )}
            renderCompactRow={(row) => (
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <ClientIdentity row={row} />
                            <div className="mt-2 flex flex-wrap items-center gap-2">{typeBadge(row.client)}{statusBadge(row.client)}</div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-3 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]"><Mail className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{row.client.email || "Sin email"}</span></span>
                        <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]"><Phone className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{row.client.phone || "Sin teléfono"}</span></span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]"><MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.locationCount} ubicaciones</span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.taskCount} ({row.pendingTaskCount} pend.)</span>
                        {financialDataAvailable && <><span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(row.annualBillingTotal)}</span><span className={`font-mono font-semibold ${row.pendingBalance > 0 ? "text-[var(--btn-cancel-text)]" : "text-emerald-700"}`}>{formatCurrency(row.pendingBalance)}</span></>}
                    </div>
                </div>
            )}
            renderDesktopRow={(row) => (
                <>
                    <ClientIdentity row={row} />
                    <div>{typeBadge(row.client)}</div>
                    <div className="min-w-0 text-xs text-[var(--text-muted)]">
                        <p className="truncate font-medium text-[var(--text-main)]">{row.client.email || "Sin contacto"}</p>
                        <p className="mt-0.5 truncate">{row.client.address || row.client.city}</p>
                    </div>
                    <p className="truncate text-xs text-[var(--text-muted)]">{row.client.phone || "—"}</p>
                    <span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{row.locationCount}</span>
                    <span className="flex items-center justify-end gap-1.5 font-mono text-sm font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.taskCount}</span>
                    {financialDataAvailable && <>
                        <span className="text-right font-mono text-xs font-semibold text-[var(--text-main)]">{formatCurrency(row.annualBillingTotal)}</span>
                        <span className={`text-right font-mono text-xs font-semibold ${row.pendingBalance > 0 ? "text-[var(--btn-cancel-text)]" : "text-emerald-700"}`}>{formatCurrency(row.pendingBalance)}</span>
                    </>}
                    <div>{statusBadge(row.client)}</div>
                    <span className="truncate text-xs text-[var(--text-muted)]">{row.lastActivityAt ? formatDate(row.lastActivityAt) : "—"}</span>
                    {!isReadOnly && <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</div>}
                </>
            )}
        />
    );
}
