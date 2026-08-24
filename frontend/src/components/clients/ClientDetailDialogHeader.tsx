"use client";

import { ArrowLeft, Building2, Pencil, Power, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import type { Client } from "@/services/client.service";

type ClientDetailDialogHeaderProps = {
    client: Client;
    canManage: boolean;
    onEditClient?: (client: Client) => void;
    onToggleActiveClient?: (client: Client) => void;
    onDeleteClient?: (client: Client) => void;
    onClose: () => void;
};

export function ClientDetailDialogHeader({
    client,
    canManage,
    onEditClient,
    onToggleActiveClient,
    onDeleteClient,
    onClose,
}: ClientDetailDialogHeaderProps) {
    const { dict } = useDictionary();
    const workspace = dict.clients.workspace;
    const edit = () => {
        onClose();
        onEditClient?.(client);
    };

    return (
        <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-7">
            <div className="flex min-w-0 items-center justify-between gap-3 pr-12">
                <Button type="button" variant="outline" size="xs" onClick={onClose}>
                    <ArrowLeft aria-hidden="true" /> {dict.clients.details.title}
                </Button>
                {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                        {onEditClient && <Button type="button" variant="secondary" size="sm" onClick={edit}><Pencil aria-hidden="true" />{dict.clients.table.edit}</Button>}
                        <ActionPopover
                            triggerLabel={workspace.actions_for.replace("{name}", client.name)}
                            options={[
                                ...(onToggleActiveClient ? [{ label: client.is_active ? workspace.deactivate : workspace.activate, icon: Power, onClick: () => onToggleActiveClient(client), variant: "deactivate" as const }] : []),
                                ...(onDeleteClient ? [{ label: dict.clients.table.delete, icon: Trash2, onClick: () => { onClose(); onDeleteClient(client); }, variant: "delete" as const }] : []),
                            ]}
                        />
                    </div>
                )}
            </div>
            <div className="mt-4 flex min-w-0 items-start gap-3 pr-12">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent" aria-hidden="true"><Building2 className="h-5 w-5" /></span>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle className="truncate text-2xl font-bold text-[var(--text-main)]">{client.name}</DialogTitle>
                        <Badge className={client.is_active ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}>{client.is_active ? dict.clients.table.active : dict.clients.table.inactive}</Badge>
                    </div>
                    <DialogDescription className="mt-1 font-mono text-xs">{dict.clients.title} · {client.legal_number || workspace.no_tax_id}</DialogDescription>
                </div>
            </div>
        </DialogHeader>
    );
}
