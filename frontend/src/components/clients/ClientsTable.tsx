"use client";

import {
    Building2,
    CircleCheck,
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
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import type { Client } from "@/services/client.service";

type ClientsTableProps = {
    rows: ClientWorkspaceRow[];
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
    onToggleActive: (client: Client) => void;
    onDetails: (client: Client) => void;
};

function ClientIdentity({ row, noTaxId }: { row: ClientWorkspaceRow; noTaxId: string }) {
    const Icon = row.client.client_type === "individual" ? UserRound : Building2;
    return (
        <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-main)]">{row.client.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">{row.client.legal_number || noTaxId}</p>
            </div>
        </div>
    );
}

export function ClientsTable({
    rows,
    onEdit,
    onDelete,
    onToggleActive,
    onDetails,
}: ClientsTableProps) {
    const { dict } = useDictionary();
    const workspace = dict.clients.workspace;
    const { user } = useUser();
    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";
    const gridClassName = isReadOnly
        ? "grid-cols-[minmax(15rem,1.45fr)_7rem_minmax(12rem,1fr)_6rem_5.5rem_6rem]"
        : "grid-cols-[minmax(15rem,1.45fr)_7rem_minmax(12rem,1fr)_6rem_5.5rem_6rem_2.25rem]";

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
            triggerLabel={workspace.actions_for.replace("{name}", client.name)}
            options={[
                ...(!isReadOnly ? [
                    { label: dict.clients.table.edit, icon: Pencil, onClick: () => onEdit(client), variant: "edit" as const },
                    { label: client.is_active ? workspace.deactivate : workspace.activate, icon: Power, onClick: () => onToggleActive(client), variant: "deactivate" as const },
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
            rowAriaLabel={(row) => workspace.view_client.replace("{name}", row.client.name)}
            header={{
                title: workspace.list_title,
                subtitle: workspace.list_subtitle,
                countLabel: `${rows.length} ${rows.length === 1 ? workspace.client_singular : workspace.client_plural}`,
            }}
            columns={[
                { key: "client", label: dict.clients.table.name },
                { key: "type", label: dict.locations.table.type },
                { key: "contact", label: workspace.filter_contact },
                { key: "locations", label: workspace.locations, className: "text-right" },
                { key: "jobs", label: workspace.jobs, className: "text-right" },
                { key: "status", label: dict.clients.table.status },
                ...(!isReadOnly ? [{ key: "actions", label: <span className="sr-only">Acciones</span>, className: "text-right" }] : []),
            ]}
            empty={(
                <>
                    <Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <h2 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{workspace.empty_title}</h2>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">{workspace.empty_description}</p>
                </>
            )}
            renderCompactRow={(row) => (
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <ClientIdentity row={row} noTaxId={workspace.no_tax_id} />
                            <div className="mt-2 flex flex-wrap items-center gap-2">{typeBadge(row.client)}{statusBadge(row.client)}</div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-3 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]"><Mail className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{row.client.email || workspace.no_email}</span></span>
                        <span className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]"><Phone className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{row.client.phone || workspace.no_phone}</span></span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]"><MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.locationCount} {workspace.locations.toLowerCase()}</span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.taskCount} ({row.pendingTaskCount} {workspace.pending_short})</span>
                    </div>
                </div>
            )}
            renderDesktopRow={(row) => (
                <>
                    <ClientIdentity row={row} noTaxId={workspace.no_tax_id} />
                    <div>{typeBadge(row.client)}</div>
                    <div className="min-w-0 text-xs text-[var(--text-muted)]">
                        <p className="truncate font-medium text-[var(--text-main)]">{row.client.email || workspace.no_contact}</p>
                        <p className="mt-0.5 truncate">{row.client.address || row.client.city}</p>
                    </div>
                    <span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{row.locationCount}</span>
                    <span className="flex items-center justify-end gap-1.5 font-mono text-sm font-semibold text-[var(--text-main)]"><ListChecks className="h-3.5 w-3.5 text-accent" aria-hidden="true" />{row.taskCount}</span>
                    <div>{statusBadge(row.client)}</div>
                    {!isReadOnly && <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</div>}
                </>
            )}
        />
    );
}
