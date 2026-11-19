"use client";

import {useViewState} from "@/hooks/useViewState";
import {Input} from "@/components/ui/input";
import {CompactFilterSelect} from "@/components/ui/compact-filter-select";
import { Pencil, ShieldCheck } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import type { Role } from "@/services/role.service";

type RolesListSectionProps = {
    roles: Role[];
    labels: {
        listTitle: string;
        listSubtitle: string;
        roleName: string;
        description: string;
        status: string;
        actions: string;
        active: string;
        inactive: string;
        edit: string;
        empty: string;
        countOne: string;
        countMany: string;
    };
    onEdit: (role: Role) => void;
};

export function RolesListSection({
    roles,
    labels,
    onEdit,
}: RolesListSectionProps) {
    const [query,setQuery]=useViewState("roles.query", "");
    const [state,setState]=useViewState("roles.state", "");
    const visible=roles.filter(role=>[role.name,role.description].filter(Boolean).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(!state||(state==="active"?role.is_active===true:role.is_active===false)));
    const statusBadge = (role: Role) => (
        <Badge
            variant="outline"
            className={role.is_active===true
                ? "border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}
        >
            {role.is_active===true?labels.active:role.is_active===false?labels.inactive:"Estado pendiente"}
        </Badge>
    );

    const actionOptions = (role: Role) => [
        {
            label: labels.edit,
            icon: Pencil,
            variant: "edit" as const,
            onClick: () => onEdit(role),
        },
    ];

    return (
        <DataListTable
            items={visible}
            persistenceKey="roles.catalog"
            toolbar={<div className="space-y-2"><div className="grid gap-2 sm:grid-cols-[1fr_12rem]"><Input type="search" aria-label="Buscar rol por nombre o descripción" placeholder="Buscar rol…" value={query} onChange={event=>setQuery(event.target.value)}/><CompactFilterSelect aria-label="Estado del rol" value={state} onValueChange={setState} options={[{value:"",label:"Todos los estados"},{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}]}/></div><p className="text-xs text-muted-foreground">{visible.length} de {roles.length} roles. Catálogo global del sistema; la asignación a usuarios y sus concesiones se administran en los apartados correspondientes.</p></div>}
            getRowKey={(role) => role.id}
            desktopFrom="lg"
            header={{
                title: labels.listTitle,
                subtitle: labels.listSubtitle,
                countLabel: `${roles.length} ${roles.length === 1 ? labels.countOne : labels.countMany}`,
            }}
            columns={[
                { key: "name", label: labels.roleName },
                { key: "description", label: labels.description },
                { key: "status", label: labels.status },
                { key: "actions", label: labels.actions, className: "text-right" },
            ]}
            empty={(
                <>
                    <ShieldCheck className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{query||state?"No hay roles con estos filtros. Cambia la búsqueda o el estado.":labels.empty}</p>
                </>
            )}
            renderCompactRow={(role) => (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                                    <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                    {role.name}
                                </span>
                                {statusBadge(role)}
                            </div>
                        </div>
                        <ActionPopover align="end" options={actionOptions(role)} />
                    </div>
                    <div className="mt-2.5 border-t border-[var(--border-soft)] pt-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                        {role.description || "—"}
                    </div>
                </>
            )}
            renderDesktopRow={(role) => (
                <>
                    <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-[var(--text-main)]">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        {role.name}
                    </p>
                    <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">
                        {role.description || "—"}
                    </p>
                    <div className="flex items-center">{statusBadge(role)}</div>
                    <div className="flex items-center justify-end">
                        <ActionPopover align="end" options={actionOptions(role)} />
                    </div>
                </>
            )}
        />
    );
}
