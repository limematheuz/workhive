"use client";

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

const GRID =
    "grid-cols-[minmax(10rem,1.1fr)_minmax(14rem,1.6fr)_7.5rem_5.5rem]";

export function RolesListSection({
    roles,
    labels,
    onEdit,
}: RolesListSectionProps) {
    const statusBadge = (role: Role) => (
        <Badge
            variant="outline"
            className={role.is_active
                ? "border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"}
        >
            {role.is_active ? labels.active : labels.inactive}
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
            items={roles}
            getRowKey={(role) => role.id}
            gridClassName={GRID}
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
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{labels.empty}</p>
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
