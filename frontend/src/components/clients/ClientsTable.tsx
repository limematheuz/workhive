"use client"

import { Client } from "@/services/client.service";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Power, Trash2, Mail, Phone } from "lucide-react";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { ActionPopover } from "@/components/ui/action-popover";
import * as React from "react";

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


    if (!clients || clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-soft)]">
                <p className="text-[var(--text-muted)] text-lg">{dict.clients.table.empty}</p>
            </div>
        );
    }

    const statusBadge = (client: Client) => (
        <Badge
            variant={client.is_active ? "default" : "secondary"}
            className={client.is_active
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase"
                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-soft)] text-[9px] font-bold uppercase"}
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
            <Badge className="border border-accent/20 bg-accent/10 text-[9px] font-bold uppercase text-accent">
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
                    label: client.is_active
                        ? "Desactivar"
                        : "Activar",
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
        <>
            {/* ── Mobile & Tablet: Cards ── */}
            <div className="lg:hidden space-y-3">
                {clients.map((client) => (
                    <div
                        key={client.id}
                        role="button"
                        tabIndex={0}
                        aria-label={client.name}
                        onClick={() => onDetails(client)}
                        onKeyDown={(event) => {
                            // Only handle keys on the card itself, not on nested interactive elements
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                                if (event.key === " ") event.preventDefault();
                                onDetails(client);
                            }
                        }}
                        className="surface-glass-card rounded-2xl p-4 space-y-3 cursor-pointer hover:border-[var(--border-color)] transition-colors active:scale-[0.99]"
                    >
                        {/* Header: Name + Status + Menu */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-[var(--text-main)]">{client.name}</span>
                                    {typeBadge(client)}
                                    {statusBadge(client)}
                                </div>
                                <span className="text-2xs font-mono text-[var(--text-muted)] mt-0.5 block">
                                    {client.legal_number || "Sin NIF/CIF"}
                                </span>
                            </div>
                            {!isReadOnly && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    {renderActionPopover(client)}
                                </div>
                            )}
                        </div>

                        {/* Info rows */}
                        <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                            <div className="flex items-center gap-2 text-xs">
                                <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                <span className="text-[var(--text-muted)] truncate">{client.email || "Sin email"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Phone className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                <span className="text-[var(--text-muted)]">{client.phone || "Sin teléfono"}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Desktop: Table ── */}
            <div className="hidden lg:block surface-glass-card rounded-2xl overflow-hidden w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{dict.clients.table.name}</TableHead>
                            <TableHead>{dict.clients.table.legal_number}</TableHead>
                            <TableHead>{dict.clients.table.email}</TableHead>
                            <TableHead>{dict.clients.table.phone}</TableHead>
                            <TableHead>{dict.clients.table.status}</TableHead>
                            {!isReadOnly && <TableHead className="text-right">{dict.clients.table.actions}</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <TableRow
                                key={client.id}
                                onClick={() => onDetails(client)}
                                className="cursor-pointer hover:bg-[var(--bg-secondary)]/40 transition-all duration-150"
                            >
                                <TableCell className="font-semibold">
                                    <div className="flex items-center gap-2">
                                        {client.name}
                                        {typeBadge(client)}
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{client.legal_number || "—"}</TableCell>
                                <TableCell className="text-[var(--text-muted)]">{client.email || "—"}</TableCell>
                                <TableCell className="text-[var(--text-muted)]">{client.phone || "—"}</TableCell>
                                <TableCell>{statusBadge(client)}</TableCell>
                                {!isReadOnly && (
                                    <TableCell className="text-right">
                                        {renderActionPopover(client)}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

        </>
    );
}
