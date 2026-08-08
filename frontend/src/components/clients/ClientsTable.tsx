"use client";

import { Mail, Pencil, Phone, Power, Trash2, Users } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ActionPopover } from "@/components/ui/action-popover";
import { DataListTable } from "@/components/ui/data-list-table";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { Client } from "@/services/client.service";

interface ClientsTableProps {
    clients: Client[];
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
    onToggleActive: (client: Client) => void;
    onDetails: (client: Client) => void;
}

export function ClientsTable({ clients, onEdit, onDelete, onToggleActive, onDetails }: ClientsTableProps) {
    const { dict } = useDictionary();
    const { user } = useUser();
    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";
    const gridClassName = isReadOnly
        ? "grid-cols-[minmax(12rem,1.3fr)_minmax(7rem,.8fr)_minmax(10rem,1.1fr)_minmax(7rem,.8fr)_7.5rem]"
        : "grid-cols-[minmax(12rem,1.3fr)_minmax(7rem,.8fr)_minmax(10rem,1.1fr)_minmax(7rem,.8fr)_7.5rem_5.5rem]";

    const statusBadge = (client: Client) => (
        <Badge
            variant={client.is_active ? "default" : "secondary"}
            className={client.is_active
                ? "border border-accent/25 bg-accent/10 text-[9px] font-semibold uppercase text-accent"
                : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[9px] font-semibold uppercase text-[var(--text-muted)]"}
        >
            {client.is_active ? dict.clients.table.active : dict.clients.table.inactive}
        </Badge>
    );

    const typeBadge = (client: Client) => {
        if (client.client_type === "company") {
            return (
                <Badge className="badge-standard badge-collaborator">
                    {dict.clients.table.collaborator || "Colaborador"}
                </Badge>
            );
        }
        return (
            <Badge className="border border-accent/20 bg-accent/10 text-[9px] font-semibold uppercase text-accent">
                {client.client_type === "business"
                    ? (dict.clients.table.company || "Empresa")
                    : (dict.clients.table.individual || "Particular")}
            </Badge>
        );
    };

    const renderActionPopover = (client: Client) => (
        <ActionPopover
            align="end"
            options={[
                {
                    label: dict.clients.table.edit,
                    icon: Pencil,
                    onClick: () => onEdit(client),
                    variant: "edit" as const,
                },
                {
                    label: client.is_active ? "Desactivar" : "Activar",
                    icon: Power,
                    onClick: () => onToggleActive(client),
                    variant: "deactivate" as const,
                },
                {
                    label: dict.clients.table.delete,
                    icon: Trash2,
                    onClick: () => onDelete(client),
                    variant: "delete" as const,
                },
            ]}
        />
    );

    return (
        <DataListTable
            items={clients}
            getRowKey={(client) => client.id}
            gridClassName={gridClassName}
            desktopFrom="lg"
            onRowClick={onDetails}
            rowAriaLabel={(client) => client.name}
            header={{
                title: "Clientes registrados",
                subtitle: "Pulsa una fila para ver el detalle del cliente.",
                countLabel: `${clients.length} ${clients.length === 1 ? "cliente" : "clientes"}`,
            }}
            columns={[
                { key: "name", label: dict.clients.table.name },
                { key: "legal", label: dict.clients.table.legal_number },
                { key: "email", label: dict.clients.table.email },
                { key: "phone", label: dict.clients.table.phone },
                { key: "status", label: dict.clients.table.status },
                ...(isReadOnly
                    ? []
                    : [{ key: "actions", label: dict.clients.table.actions, className: "text-right" }]),
            ]}
            empty={(
                <>
                    <Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{dict.clients.table.empty}</p>
                </>
            )}
            renderCompactRow={(client) => (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--text-main)]">{client.name}</span>
                                {typeBadge(client)}
                                {statusBadge(client)}
                            </div>
                            <span className="mt-0.5 block font-mono text-[11px] text-[var(--text-muted)]">
                                {client.legal_number || "Sin NIF/CIF"}
                            </span>
                        </div>
                        {!isReadOnly && (
                            <div onClick={(e) => e.stopPropagation()}>
                                {renderActionPopover(client)}
                            </div>
                        )}
                    </div>
                    <div className="mt-2.5 space-y-1.5 border-t border-[var(--border-soft)] pt-2.5">
                        <div className="flex items-center gap-2 text-xs">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                            <span className="truncate text-[var(--text-muted)]">{client.email || "Sin email"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                            <span className="text-[var(--text-muted)]">{client.phone || "Sin teléfono"}</span>
                        </div>
                    </div>
                </>
            )}
            renderDesktopRow={(client) => (
                <>
                    <div className="flex min-w-0 items-center gap-2 font-semibold text-[var(--text-main)]">
                        <span className="truncate">{client.name}</span>
                        {typeBadge(client)}
                    </div>
                    <p className="font-mono text-xs text-[var(--text-muted)]">{client.legal_number || "—"}</p>
                    <p className="truncate text-sm text-[var(--text-muted)]">{client.email || "—"}</p>
                    <p className="text-sm text-[var(--text-muted)]">{client.phone || "—"}</p>
                    <div>{statusBadge(client)}</div>
                    {!isReadOnly && (
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                            {renderActionPopover(client)}
                        </div>
                    )}
                </>
            )}
        />
    );
}
