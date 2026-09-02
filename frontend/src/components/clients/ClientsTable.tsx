"use client";

import {
    Building2,
    CircleCheck,
    Pencil,
    Power,
    Trash2,
    UserRound,
    Users,
} from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    const pagination = useDataTablePagination(rows, 10);

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

    const relationshipBadge = (client: Client) => client.relationship_status === "lead"
        ? <Badge variant="secondary" className="text-[10px] font-semibold">{dict.clients.form.relationship_status_lead}</Badge>
        : null;

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
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-[var(--text-main)]">{workspace.list_title}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{workspace.list_subtitle}</p></div><span className="w-fit rounded-full bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">{rows.length} {rows.length === 1 ? workspace.client_singular : workspace.client_plural}</span></header>
            {rows.length === 0 ? <div className="px-5 py-16 text-center"><Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" /><h2 className="mt-3 text-sm font-semibold text-[var(--text-main)]">{workspace.empty_title}</h2><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--text-muted)]">{workspace.empty_description}</p></div> : <>
                <div className="hidden lg:block"><Table className="table-fixed text-left"><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><TableHead className="w-[27%] text-[var(--btn-secondary-text)]">{dict.clients.table.name}</TableHead><TableHead className="w-[14%] text-[var(--btn-secondary-text)]">{dict.locations.table.type}</TableHead><TableHead className="w-[23%] text-[var(--btn-secondary-text)]">{workspace.filter_contact}</TableHead><TableHead className="w-[8%] text-right text-[var(--btn-secondary-text)]">{workspace.locations}</TableHead><TableHead className="w-[8%] text-right text-[var(--btn-secondary-text)]">{workspace.jobs}</TableHead><TableHead className="w-[12%] text-[var(--btn-secondary-text)]">{dict.clients.table.status}</TableHead>{!isReadOnly && <TableHead className="w-[8%] text-right text-[var(--btn-secondary-text)]">{dict.clients.table.actions}</TableHead>}</TableRow></TableHeader><TableBody>{pagination.pageItems.map((row) => <TableRow key={row.client.id} onClick={() => onDetails(row.client)} className="cursor-pointer bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55"><TableCell><ClientIdentity row={row} noTaxId={workspace.no_tax_id} /></TableCell><TableCell><div className="flex flex-wrap gap-1.5">{typeBadge(row.client)}{relationshipBadge(row.client)}</div></TableCell><TableCell><p className="truncate text-xs font-medium text-[var(--text-main)]">{row.client.email || workspace.no_contact}</p><p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{row.client.address || row.client.city}</p></TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{row.locationCount}</TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{row.taskCount}</TableCell><TableCell>{statusBadge(row.client)}</TableCell>{!isReadOnly && <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</TableCell>}</TableRow>)}</TableBody></Table></div>
                <div className="grid gap-2.5 p-3 lg:hidden">{pagination.pageItems.map((row) => <Card key={row.client.id}><CardContent className="space-y-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><ClientIdentity row={row} noTaxId={workspace.no_tax_id} /></div>{!isReadOnly && <div onClick={(event) => event.stopPropagation()}>{renderActions(row.client)}</div>}</div><div className="flex flex-wrap gap-1.5">{typeBadge(row.client)}{relationshipBadge(row.client)}{statusBadge(row.client)}</div><div className="border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--text-muted)]"><p className="truncate font-medium text-[var(--text-main)]">{row.client.email || workspace.no_contact}</p><p className="mt-1 truncate">{row.client.address || row.client.city || "—"}</p></div><div className="grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-2 text-[var(--text-muted)]"><b className="font-mono text-sm text-[var(--text-main)]">{row.locationCount}</b> {workspace.locations.toLowerCase()}</span><span className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-2 text-[var(--text-muted)]"><b className="font-mono text-sm text-[var(--text-main)]">{row.taskCount}</b> {workspace.jobs.toLowerCase()}</span></div></CardContent></Card>)}</div>
                <DataTablePagination page={pagination.page} totalItems={rows.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, rows.length)} de ${rows.length} clientes`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />
            </>}
        </section>
    );
}
