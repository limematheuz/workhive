"use client";

import { Edit2, Trash2, Users } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { DataListTable } from "@/components/ui/data-list-table";
import type { User } from "@/types/user";

import { getRoleRank, getRoleText } from "./user-role-utils";

type TeamListSectionProps = {
    team: User[];
    currentUser: User | null;
    labels: {
        full_name: string;
        email: string;
        role: string;
        status: string;
        actions: string;
        status_active: string;
        status_inactive: string;
        you?: string;
        empty: string;
        role_superadmin?: string;
        role_admin?: string;
        role_manager?: string;
        role_installer?: string;
        role_viewer?: string;
    };
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
};

const GRID =
    "grid-cols-[minmax(10rem,1.25fr)_minmax(12rem,1.4fr)_minmax(9rem,1fr)_7.5rem_5.5rem]";

export function TeamListSection({
    team,
    currentUser,
    labels,
    onEdit,
    onDelete,
}: TeamListSectionProps) {
    const roleLabels = {
        role_superadmin: labels.role_superadmin,
        role_admin: labels.role_admin,
        role_manager: labels.role_manager,
        role_installer: labels.role_installer,
        role_viewer: labels.role_viewer,
    };

    const canManageUser = (worker: User) =>
        worker.id !== currentUser?.id
        && getRoleRank(currentUser?.role?.name) > getRoleRank(worker.role?.name);

    const actionOptions = (worker: User) => [
        {
            label: "Editar",
            icon: Edit2,
            onClick: () => onEdit(worker),
            variant: "edit" as const,
        },
        {
            label: "Eliminar definitivamente",
            icon: Trash2,
            onClick: () => onDelete(worker),
            variant: "delete" as const,
        },
    ];

    const statusBadge = (worker: User) => (
        (worker.is_active ?? true) ? (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-500">
                {labels.status_active}
            </span>
        ) : (
            <span className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                {labels.status_inactive}
            </span>
        )
    );

    return (
        <DataListTable
            items={team}
            getRowKey={(worker) => worker.id}
            gridClassName={GRID}
            desktopFrom="lg"
            header={{
                title: "Equipo",
                subtitle: "Gestiona roles y acceso de los miembros.",
                countLabel: `${team.length} ${team.length === 1 ? "miembro" : "miembros"}`,
            }}
            columns={[
                { key: "name", label: labels.full_name },
                { key: "email", label: labels.email },
                { key: "role", label: labels.role },
                { key: "status", label: labels.status },
                { key: "actions", label: labels.actions, className: "text-right" },
            ]}
            empty={(
                <>
                    <Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{labels.empty}</p>
                </>
            )}
            renderCompactRow={(worker) => (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--text-main)]">
                                    {worker.full_name || "-"}
                                </span>
                                {worker.id === currentUser?.id && (
                                    <span className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                        {labels.you || "Tú"}
                                    </span>
                                )}
                                {statusBadge(worker)}
                            </div>
                            <span className="mt-0.5 block text-[11px] font-medium text-[var(--text-muted)]">
                                {getRoleText(worker.role?.name || "", roleLabels)}
                            </span>
                        </div>
                        {canManageUser(worker) && (
                            <ActionPopover align="end" options={actionOptions(worker)} />
                        )}
                    </div>
                    <div className="mt-2.5 border-t border-[var(--border-soft)] pt-2.5">
                        <p className="truncate text-xs text-[var(--text-muted)]">{worker.email}</p>
                    </div>
                </>
            )}
            renderDesktopRow={(worker) => (
                <>
                    <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-main)]">
                        {worker.full_name || "-"}
                        {worker.id === currentUser?.id && (
                            <span className="ml-2 rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                {labels.you || "Tú"}
                            </span>
                        )}
                    </p>
                    <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">{worker.email}</p>
                    <p className="min-w-0 truncate text-sm font-medium text-[var(--text-muted)]">
                        {getRoleText(worker.role?.name || "", roleLabels)}
                    </p>
                    <div className="flex items-center">{statusBadge(worker)}</div>
                    <div className="flex items-center justify-end">
                        {worker.id !== currentUser?.id ? (
                            canManageUser(worker) ? (
                                <ActionPopover align="end" options={actionOptions(worker)} />
                            ) : (
                                <span className="text-xs font-medium text-[var(--text-muted)]">-</span>
                            )
                        ) : (
                            <span className="text-xs font-medium text-[var(--text-muted)]">Tú</span>
                        )}
                    </div>
                </>
            )}
        />
    );
}
