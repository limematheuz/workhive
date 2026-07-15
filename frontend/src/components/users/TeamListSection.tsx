"use client";

import { Edit2, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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

    if (team.length === 0) {
        return (
            <div className="text-center py-20 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)]">
                <p className="text-sm text-[var(--text-muted)]">{labels.empty}</p>
            </div>
        );
    }

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

    return (
        <>
            <div className="lg:hidden space-y-3">
                {team.map((worker) => (
                    <div
                        key={worker.id}
                        className="surface-glass-card rounded-2xl p-4 space-y-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-[var(--text-main)]">
                                        {worker.full_name || "-"}
                                    </span>
                                    {worker.id === currentUser?.id && (
                                        <span className="bg-accent/10 text-accent text-3xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-accent/20">
                                            {labels.you || "Tú"}
                                        </span>
                                    )}
                                    {(worker.is_active ?? true) ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            {labels.status_active}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-neutral-500/10 text-[var(--text-muted)] border border-[var(--border-soft)]">
                                            {labels.status_inactive}
                                        </span>
                                    )}
                                </div>
                                <span className="text-2xs text-[var(--text-muted)] font-medium mt-0.5 block">
                                    {getRoleText(worker.role?.name || "", roleLabels)}
                                </span>
                            </div>
                            {canManageUser(worker) && (
                                <ActionPopover align="end" options={actionOptions(worker)} />
                            )}
                        </div>
                        <div className="pt-2 border-t border-[var(--border-soft)]/50">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="truncate">{worker.email}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden lg:block surface-glass-card rounded-2xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{labels.full_name}</TableHead>
                            <TableHead>{labels.email}</TableHead>
                            <TableHead>{labels.role}</TableHead>
                            <TableHead className="text-center">{labels.status}</TableHead>
                            <TableHead className="text-center">{labels.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {team.map((worker) => (
                            <TableRow key={worker.id}>
                                <TableCell className="font-semibold text-[var(--text-main)]">
                                    {worker.full_name || "-"}
                                    {worker.id === currentUser?.id && (
                                        <span className="ml-2 bg-accent/10 text-accent text-3xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-accent/20">
                                            {labels.you || "Tú"}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-[var(--text-muted)]">{worker.email}</TableCell>
                                <TableCell className="text-[var(--text-muted)] font-medium">
                                    {getRoleText(worker.role?.name || "", roleLabels)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {(worker.is_active ?? true) ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            {labels.status_active}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/10 text-[var(--text-muted)] border border-[var(--border-soft)]">
                                            {labels.status_inactive}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {worker.id !== currentUser?.id ? (
                                        canManageUser(worker) ? (
                                            <div className="flex justify-center">
                                                <ActionPopover align="end" options={actionOptions(worker)} />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-[var(--text-muted)] font-medium">-</span>
                                        )
                                    ) : (
                                        <span className="text-xs text-[var(--text-muted)] font-medium">Tú</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
