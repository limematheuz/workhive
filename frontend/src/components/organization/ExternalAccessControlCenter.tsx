"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { CircleCheck, Loader2, Pencil, UserPlus, UserRound } from "lucide-react";

import { UserCreateDialog } from "@/components/users/UserCreateDialog";
import { UserEditDialog } from "@/components/users/UserEditDialog";
import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { RoleService, type Role } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import type { User } from "@/types/user";

const EXTERNAL_PORTAL_ROLE = "external_portal";

type EditState = {
    open: boolean;
    user: User | null;
};

type ExternalAccessControlCenterProps = {
    embedded?: boolean;
};

function statusBadge(active: boolean, copy: { active: string; revoked: string }) {
    return active ? (
        <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-700">
            <CircleCheck className="mr-1 size-3" aria-hidden="true" />
            {copy.active}
        </Badge>
    ) : <Badge variant="secondary" className="text-[10px] font-semibold">{copy.revoked}</Badge>;
}

export function ExternalAccessControlCenter({ embedded = false }: ExternalAccessControlCenterProps) {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const copy = dict.organization.external_access;
    const isCompanyAdmin = user?.role?.name === "admin" && Boolean(user.company_id);
    const [accesses, setAccesses] = useState<User[]>([]);
    const [externalRole, setExternalRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [edit, setEdit] = useState<EditState>({ open: false, user: null });

    const load = useCallback(async () => {
        if (!isCompanyAdmin) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [roles, users] = await Promise.all([RoleService.getRoles(), UserService.getUsers()]);
            setExternalRole(roles.find((role) => role.name === EXTERNAL_PORTAL_ROLE) ?? null);
            setAccesses(users.filter((candidate) => candidate.role?.name === EXTERNAL_PORTAL_ROLE));
        } catch (error) {
            toast.error(getErrorMessage(error, copy.load_error));
        } finally {
            setLoading(false);
        }
    }, [copy.load_error, isCompanyAdmin]);
    const loadEvent = useEffectEvent(load);

    useEffect(() => {
        if (!userLoading) startTransition(() => { void loadEvent(); });
    }, [userLoading]);

    const pagination = useDataTablePagination(accesses, 10);
    const summary = copyPagination(dict.organization.pagination.summary, pagination.page, pagination.pageSize, accesses.length);
    const externalRoles = useMemo(() => externalRole ? [externalRole] : [], [externalRole]);

    const pageClassName = embedded ? "space-y-5" : "dashboard-page-content px-[3%] py-6 md:p-8";
    const header = (
        <PageHeader
            icon={UserRound}
            title={copy.title}
            subtitle={copy.subtitle}
            titleAs={embedded ? "h2" : "h1"}
            className={embedded ? "mb-6" : "mb-7"}
            actions={<Button type="button" onClick={() => setInviteOpen(true)} disabled={!externalRole}><UserPlus className="mr-2 size-4" />{copy.invite}</Button>}
        />
    );

    if (!userLoading && !isCompanyAdmin) {
        return <div className={pageClassName}>{header}<p className="text-sm text-[var(--text-muted)]">{copy.no_permission}</p></div>;
    }

    return (
        <div className={pageClassName}>
            {header}

            <p className="mb-5 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">{copy.info}</p>

            {loading ? <div className="flex items-center justify-center gap-3 py-20 text-sm text-[var(--text-muted)]"><Loader2 className="size-5 animate-spin text-accent" />{dict.organization.loading}</div> : (
                <section id="external-access-list" className="billing-surface overflow-hidden rounded-[26px]">
                    <header className="flex items-center justify-between gap-3 px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-main)]">{copy.list_title}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{copy.list_subtitle}</p></div><span className="rounded-full bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">{accesses.length}</span></header>
                    {accesses.length === 0 ? <div className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{copy.empty}</div> : <>
                        <div className="hidden md:block [&_[data-slot=table-container]]:overflow-x-hidden">
                            <Table className="table-fixed">
                                <TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--btn-secondary-text)]">
                                    <TableHead className="w-[30%] px-3 py-3">{copy.person}</TableHead><TableHead className="w-[31%] px-3 py-3">{dict.users.email}</TableHead><TableHead className="w-[19%] px-3 py-3">{copy.access}</TableHead><TableHead className="w-[14%] px-3 py-3">{dict.users.status}</TableHead><TableHead className="w-[6%] px-3 py-3 text-right"><span className="sr-only">{dict.users.actions}</span></TableHead>
                                </TableRow></TableHeader>
                                <TableBody>{pagination.pageItems.map((access) => <TableRow key={access.id} className="bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55"><TableCell className="px-3 py-3"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{access.full_name || "—"}</p></TableCell><TableCell className="px-3 py-3"><p className="truncate text-xs text-[var(--text-muted)]">{access.email}</p></TableCell><TableCell className="px-3 py-3"><p className="text-xs font-medium text-[var(--text-main)]">{copy.access_value}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{copy.scope}</p></TableCell><TableCell className="px-3 py-3">{statusBadge(access.is_active ?? true, copy)}</TableCell><TableCell className="px-3 py-3 text-right"><ActionPopover align="end" triggerLabel={`${copy.edit_title}: ${access.email}`} options={[{ label: dict.users.action_edit, icon: Pencil, onClick: () => setEdit({ open: true, user: access }), variant: "edit" }]} /></TableCell></TableRow>)}</TableBody>
                            </Table>
                        </div>
                        <div className="grid gap-2.5 p-3 md:hidden">{pagination.pageItems.map((access) => <Card key={access.id}><CardContent className="space-y-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{access.full_name || "—"}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{access.email}</p></div><ActionPopover align="end" triggerLabel={`${copy.edit_title}: ${access.email}`} options={[{ label: dict.users.action_edit, icon: Pencil, onClick: () => setEdit({ open: true, user: access }), variant: "edit" }]} /></div><div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3"><span className="text-xs text-[var(--text-muted)]">{copy.scope}</span>{statusBadge(access.is_active ?? true, copy)}</div></CardContent></Card>)}</div>
                        <DataTablePagination page={pagination.page} totalItems={accesses.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={summary} rowsPerPageLabel={dict.organization.pagination.rows_per_page} previousLabel={dict.organization.pagination.previous} nextLabel={dict.organization.pagination.next} />
                    </>}
                </section>
            )}

            <UserCreateDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={externalRoles} defaultRoleId={externalRole ? String(externalRole.id) : ""} showRoleSelector={false} onCreated={() => void load()} labels={{ new_worker: copy.invite, new_worker_desc: copy.invite_description, worker_invitation_steps: copy.invite_steps, full_name: dict.users.full_name, full_name_placeholder: dict.users.full_name_placeholder, email: dict.users.email, email_placeholder: dict.users.email_placeholder, role: dict.users.role, cancel: dict.organization.actions.cancel, submitting: dict.users.submitting, submit_create: dict.users.submit_create, success_create: dict.users.success_create, error_create: dict.users.error_create, role_external_portal: copy.access_value }} />
            <UserEditDialog open={edit.open} onOpenChange={(open) => !open && setEdit({ open: false, user: null })} user={edit.user} roles={externalRoles} showRoleSelector={false} onUpdated={() => void load()} labels={{ edit_worker: copy.edit_title, full_name: dict.users.full_name, full_name_placeholder: dict.users.full_name_placeholder, role: dict.users.role, cancel: dict.organization.actions.cancel, submitting: dict.users.submitting, submit_update: dict.users.submit_update, success_update: dict.users.success_update, error_update: dict.users.error_update, system_access: copy.access, active_access_desc: copy.active_description, inactive_access_desc: copy.revoked_description, role_external_portal: copy.access_value }} />
        </div>
    );
}

function copyPagination(template: string, page: number, pageSize: number, total: number) {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return template.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total));
}
