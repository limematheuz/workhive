"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Power, Trash2, UsersRound } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { OrganizationTableFilters } from "@/components/organization/OrganizationTableFilters";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { filterOrganizationTeams, type TeamFilters } from "@/lib/organization-filters";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
    OrganizationService,
    type OrganizationDepartment,
    type OrganizationMember,
    type OrganizationTeam,
    type OrganizationTeamUsage,
} from "@/services/organization.service";

type OrganizationTeamsPanelProps = {
    teams: OrganizationTeam[];
    departments: OrganizationDepartment[];
    members: OrganizationMember[];
    onChanged: () => Promise<void>;
};

const TEAMS_PAGE_SIZE = 20;
const UNKNOWN_USAGE: OrganizationTeamUsage = {
    member_assignments: 0,
    active_member_assignments: 0,
    profile_scopes: 0,
    active_profile_scopes: 0,
    locations: 0,
    can_deactivate: false,
    can_delete: false,
};

function teamUsage(team: OrganizationTeam) {
    return team.usage ?? UNKNOWN_USAGE;
}

function initialTeamMemberIds(members: OrganizationMember[], teamId: number) {
    const memberIds = new Set<number>();
    for (const member of members) {
        if (member.team_ids.includes(teamId)) memberIds.add(member.id);
    }
    return memberIds;
}

export function OrganizationTeamsPanel({ teams, departments, members, onChanged }: OrganizationTeamsPanelProps) {
    const { dict } = useDictionary();
    const copy = dict.organization.teams;
    const [editing, setEditing] = useState<OrganizationTeam | null>(null);
    const [membersTarget, setMembersTarget] = useState<OrganizationTeam | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<OrganizationTeam | null>(null);
    const [statusTarget, setStatusTarget] = useState<OrganizationTeam | null>(null);
    const [savingStatus, setSavingStatus] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<TeamFilters>({
        search: "",
        status: "all",
        departmentId: "all",
    });
    const filteredTeams = useMemo(
        () => filterOrganizationTeams(teams, filters),
        [teams, filters],
    );
    const pagination = useDataTablePagination(filteredTeams, TEAMS_PAGE_SIZE);
    const hasActiveFilters = filters.search.trim() !== "" || filters.status !== "all" || filters.departmentId !== "all";
    const updateFilters = (update: Partial<TeamFilters>) => {
        setFilters((current) => ({ ...current, ...update }));
        pagination.setPage(1);
    };
    const clearFilters = () => {
        setFilters({ search: "", status: "all", departmentId: "all" });
        pagination.setPage(1);
    };

    const changeStatus = async () => {
        if (!statusTarget) return;
        try {
            setSavingStatus(true);
            await OrganizationService.updateTeam(statusTarget.id, { is_active: !statusTarget.is_active });
            setStatusTarget(null);
            await onChanged();
            toast.success(copy.status_updated);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.status_update_error));
        } finally {
            setSavingStatus(false);
        }
    };

    const deleteTeam = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await OrganizationService.deleteTeam(deleteTarget.id);
            setDeleteTarget(null);
            await onChanged();
            toast.success(copy.delete_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.delete_error));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{copy.title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.description}</p>
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{filteredTeams.length} {filteredTeams.length === 1 ? copy.count_one : copy.count_many}</p>
            </header>
            <OrganizationTableFilters
                search={filters.search}
                onSearchChange={(search) => updateFilters({ search })}
                searchPlaceholder={dict.organization.filters.search_teams}
                shownCount={filteredTeams.length}
                totalCount={teams.length}
                summary={dict.organization.filters.summary}
                clearLabel={dict.organization.filters.clear}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
            >
                <Select value={filters.status} onValueChange={(status) => updateFilters({ status: status as TeamFilters["status"] })}>
                    <SelectTrigger className="h-10 w-full sm:w-44" aria-label={dict.organization.people.columns.status}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{dict.organization.filters.all_statuses}</SelectItem>
                        <SelectItem value="active">{dict.organization.access.active}</SelectItem>
                        <SelectItem value="inactive">{dict.organization.access.inactive}</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.departmentId} onValueChange={(departmentId) => updateFilters({ departmentId })}>
                    <SelectTrigger className="h-10 w-full sm:w-60" aria-label={copy.department}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{dict.organization.filters.all_departments}</SelectItem>
                        <SelectItem value="none">{copy.no_department}</SelectItem>
                        {departments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </OrganizationTableFilters>
            {filteredTeams.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{teams.length === 0 ? copy.empty : dict.organization.filters.empty}</p>
            ) : (
                <>
                    <div className="hidden lg:block"><Table className="table-fixed text-left">
                        <TableHeader>
                            <TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                <TableHead className="w-[50%] text-[var(--btn-secondary-text)] xl:w-[42%]">{dict.organization.create_dialog.name}</TableHead>
                                <TableHead className="hidden text-[var(--btn-secondary-text)] xl:table-cell xl:w-[16%]">{dict.organization.create_dialog.code_optional}</TableHead>
                                <TableHead className="hidden text-[var(--btn-secondary-text)] 2xl:table-cell 2xl:w-[18%]">{copy.department}</TableHead>
                                <TableHead className="hidden text-[var(--btn-secondary-text)] xl:table-cell xl:w-[14%]">{copy.members}</TableHead>
                                <TableHead className="w-[28%] text-[var(--btn-secondary-text)] xl:w-[10%]">{dict.organization.people.columns.status}</TableHead>
                                <TableHead className="w-[22%] text-right text-[var(--btn-secondary-text)] xl:w-[8%]">{copy.actions}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pagination.pageItems.map((team) => (
                                <TeamRow
                                    key={team.id}
                                    team={team}
                                    departments={departments}
                                    onEdit={() => setEditing(team)}
                                    onManageMembers={() => setMembersTarget(team)}
                                    onRequestStatusChange={() => setStatusTarget(team)}
                                    onRequestDelete={() => setDeleteTarget(team)}
                                />
                            ))}
                        </TableBody>
                    </Table></div>
                    <div className="grid gap-2.5 p-3 lg:hidden">
                        {pagination.pageItems.map((team) => <TeamCard key={team.id} team={team} departments={departments} onEdit={() => setEditing(team)} onManageMembers={() => setMembersTarget(team)} onRequestStatusChange={() => setStatusTarget(team)} onRequestDelete={() => setDeleteTarget(team)} />)}
                    </div>
                    <DataTablePagination
                        page={pagination.page}
                        totalItems={filteredTeams.length}
                        pageSize={pagination.pageSize}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        summary={dict.organization.pagination.summary.replace("{from}", String((pagination.page - 1) * pagination.pageSize + 1)).replace("{to}", String(Math.min(pagination.page * pagination.pageSize, filteredTeams.length))).replace("{total}", String(filteredTeams.length))}
                        rowsPerPageLabel={dict.organization.pagination.rows_per_page}
                        previousLabel={dict.organization.pagination.previous}
                        nextLabel={dict.organization.pagination.next}
                    />
                </>
            )}

            {editing && (
                <TeamEditDialog
                    key={editing.id}
                    team={editing}
                    departments={departments}
                    onOpenChange={(open) => !open && setEditing(null)}
                    onSaved={async () => {
                        setEditing(null);
                        await onChanged();
                    }}
                    onManageMembers={() => {
                        setEditing(null);
                        setMembersTarget(editing);
                    }}
                    onRequestDelete={() => {
                        setEditing(null);
                        setDeleteTarget(editing);
                    }}
                />
            )}
            {membersTarget && (
                <TeamMembersDialog
                    key={membersTarget.id}
                    team={membersTarget}
                    members={members}
                    onOpenChange={(open) => !open && setMembersTarget(null)}
                    onSaved={async () => {
                        setMembersTarget(null);
                        await onChanged();
                    }}
                />
            )}
            <DeleteConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title={copy.delete_title}
                description={copy.delete_description}
                onConfirm={() => void deleteTeam()}
                isDeleting={deleting}
                confirmText={dict.organization.actions.delete}
                cancelText={dict.organization.actions.cancel}
            />
            <DeleteConfirmDialog
                open={statusTarget !== null}
                onOpenChange={(open) => !open && setStatusTarget(null)}
                title={statusTarget?.is_active ? copy.deactivate_title : copy.reactivate_title}
                description={statusTarget?.is_active ? copy.deactivate_description : copy.reactivate_description}
                onConfirm={() => void changeStatus()}
                isDeleting={savingStatus}
                confirmText={statusTarget?.is_active ? copy.deactivate_confirm : copy.reactivate_confirm}
                cancelText={dict.organization.actions.cancel}
                confirmIcon={Power}
                confirmVariant="primary"
            />
        </section>
    );
}

function TeamCard({ team, departments, onEdit, onManageMembers, onRequestStatusChange, onRequestDelete }: { team: OrganizationTeam; departments: OrganizationDepartment[]; onEdit: () => void; onManageMembers: () => void; onRequestStatusChange: () => void; onRequestDelete: () => void; }) {
    const { dict } = useDictionary();
    const copy = dict.organization.teams;
    const usage = teamUsage(team);
    const departmentName = departments.find((department) => department.id === team.department_id)?.name || copy.no_department;
    const actionOptions: PopoverOption[] = [{ label: dict.organization.actions.edit, icon: Pencil, variant: "edit", onClick: onEdit }, { label: copy.members_action, icon: UsersRound, onClick: onManageMembers, disabled: !team.is_active }, { label: team.is_active ? copy.deactivate : copy.reactivate, icon: Power, variant: team.is_active ? "deactivate" : "default", onClick: onRequestStatusChange, disabled: team.is_active && !usage.can_deactivate }, ...(usage.can_delete ? [{ label: dict.organization.actions.delete, icon: Trash2, variant: "delete" as const, onClick: onRequestDelete }] : [])];
    return <Card><CardContent className="space-y-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{team.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{team.code || dict.organization.departments.no_code}</p></div><ActionPopover align="end" triggerLabel={`${copy.actions}: ${team.name}`} options={actionOptions} /></div><div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3"><Badge variant="outline" className={team.is_active ? "border-accent/60 bg-accent/10 text-accent" : "border-[color:var(--text-muted)]/45 text-[var(--text-muted)]"}>{team.is_active ? dict.organization.access.active : dict.organization.access.inactive}</Badge><span className="text-xs text-[var(--text-muted)]">{departmentName}</span><span className="text-xs text-[var(--text-muted)]">{usage.active_member_assignments} {copy.members.toLowerCase()}</span></div></CardContent></Card>;
}

function TeamRow({
    team,
    departments,
    onEdit,
    onManageMembers,
    onRequestStatusChange,
    onRequestDelete,
}: {
    team: OrganizationTeam;
    departments: OrganizationDepartment[];
    onEdit: () => void;
    onManageMembers: () => void;
    onRequestStatusChange: () => void;
    onRequestDelete: () => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.teams;
    const usage = teamUsage(team);
    const departmentName = departments.find((department) => department.id === team.department_id)?.name || copy.no_department;
    const actionOptions: PopoverOption[] = [
        { label: dict.organization.actions.edit, icon: Pencil, variant: "edit", onClick: onEdit },
        { label: copy.members_action, icon: UsersRound, onClick: onManageMembers, disabled: !team.is_active },
        {
            label: team.is_active ? copy.deactivate : copy.reactivate,
            icon: Power,
            variant: team.is_active ? "deactivate" : "default",
            onClick: onRequestStatusChange,
            disabled: team.is_active && !usage.can_deactivate,
        },
        ...(usage.can_delete
            ? [{ label: dict.organization.actions.delete, icon: Trash2, variant: "delete" as const, onClick: onRequestDelete }]
            : []),
    ];

    return (
        <TableRow
            className="bg-[var(--bg-secondary)]/20 last:border-b-0 hover:brightness-[0.94]"
            onClick={onEdit}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit();
                }
            }}
            tabIndex={0}
            aria-label={`${dict.organization.actions.edit} ${team.name}`}
        >
            <TableCell>
                <p className="truncate font-semibold text-[var(--text-main)]">{team.name}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] xl:hidden">{team.code || dict.organization.departments.no_code} · {departmentName}</p>
            </TableCell>
            <TableCell className="hidden text-sm text-[var(--text-muted)] xl:table-cell">{team.code || "—"}</TableCell>
            <TableCell className="hidden text-sm text-[var(--text-muted)] 2xl:table-cell">{departmentName}</TableCell>
            <TableCell className="hidden text-sm text-[var(--text-muted)] xl:table-cell">{usage.active_member_assignments}</TableCell>
            <TableCell>
                <Badge variant="outline" className={team.is_active ? "border-accent/60 bg-accent/10 text-accent" : "border-[color:var(--text-muted)]/45 text-[var(--text-muted)]"}>
                    {team.is_active ? dict.organization.access.active : dict.organization.access.inactive}
                </Badge>
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <ActionPopover align="end" triggerLabel={`${copy.actions}: ${team.name}`} options={actionOptions} />
            </TableCell>
        </TableRow>
    );
}

function TeamEditDialog({
    team,
    departments,
    onOpenChange,
    onSaved,
    onManageMembers,
    onRequestDelete,
}: {
    team: OrganizationTeam;
    departments: OrganizationDepartment[];
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
    onManageMembers: () => void;
    onRequestDelete: () => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.teams;
    const [name, setName] = useState(team.name);
    const [code, setCode] = useState(team.code ?? "");
    const [departmentId, setDepartmentId] = useState(team.department_id ? String(team.department_id) : "none");
    const [isActive, setIsActive] = useState(team.is_active ? "active" : "inactive");
    const [saving, setSaving] = useState(false);
    const usage = teamUsage(team);
    const availableDepartments = useMemo(
        () => departments.filter((department) => department.is_active || department.id === team.department_id),
        [departments, team.department_id],
    );
    const dependencies = [
        { count: usage.active_member_assignments, label: copy.active_member_assignments },
        { count: usage.active_profile_scopes, label: copy.active_profile_scopes },
    ].filter((item) => item.count > 0);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            await OrganizationService.updateTeam(team.id, {
                name: name.trim(),
                code: code.trim() || null,
                department_id: departmentId === "none" ? null : Number(departmentId),
                is_active: isActive === "active",
            });
            await onSaved();
            toast.success(copy.updated);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.update_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent compact className="max-h-[90dvh] max-w-xl overflow-y-auto">
                <form onSubmit={save} className="min-w-0 space-y-5">
                    <DialogHeader>
                        <DialogTitle>{copy.edit_title}</DialogTitle>
                        <DialogDescription>{copy.edit_description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="team-name">{dict.organization.create_dialog.name}</Label>
                        <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="team-code">{dict.organization.create_dialog.code_optional}</Label>
                        <Input id="team-code" value={code} onChange={(event) => setCode(event.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{copy.department}</Label>
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{copy.no_department}</SelectItem>
                                    {availableDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{dict.organization.people.columns.status}</Label>
                            <Select value={isActive} onValueChange={setIsActive}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">{dict.organization.access.active}</SelectItem>
                                    <SelectItem value="inactive">{dict.organization.access.inactive}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/45 p-3 text-sm text-[var(--text-muted)]">
                        <p className="font-medium text-[var(--text-main)]">{copy.current_usage}</p>
                        <p className="mt-1 text-xs leading-5">{copy.current_usage_description}</p>
                        <p className="mt-2 text-xs">{usage.active_member_assignments} {copy.active_member_assignments} · {usage.active_profile_scopes} {copy.active_profile_scopes}</p>
                        {!usage.can_delete && <p className="mt-1 text-xs">{copy.historical_data}</p>}
                    </div>
                    {isActive === "inactive" && !usage.can_deactivate && (
                        <div className="rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-sm text-[var(--btn-cancel-text)]">
                            <p className="font-medium">{copy.deactivate_blocked}</p>
                            <p className="mt-1 text-xs leading-5">{dependencies.map((item) => `${item.count} ${item.label}`).join(" · ")}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onManageMembers} disabled={!team.is_active}>{copy.manage_members}</Button>
                        {usage.can_delete && <Button type="button" variant="dangerSoft" onClick={onRequestDelete}>{dict.organization.actions.delete}</Button>}
                        <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || !name.trim() || (isActive === "inactive" && !usage.can_deactivate)}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {dict.organization.actions.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TeamMembersDialog({
    team,
    members,
    onOpenChange,
    onSaved,
}: {
    team: OrganizationTeam;
    members: OrganizationMember[];
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.teams;
    const [selectedMemberIds, setSelectedMemberIds] = useState(() => initialTeamMemberIds(members, team.id));
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const roster = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase();
        const matchingMembers: OrganizationMember[] = [];

        for (const member of members) {
            const belongsToTeam = member.team_ids.includes(team.id);
            const matchesSearch = `${member.full_name || ""} ${member.email}`
                .toLocaleLowerCase()
                .includes(normalizedSearch);

            if ((member.status === "active" || belongsToTeam) && matchesSearch) {
                matchingMembers.push(member);
            }
        }

        return matchingMembers.sort((left, right) => (
            left.full_name || left.email
        ).localeCompare(right.full_name || right.email));
    }, [members, search, team.id]);
    const allVisibleSelected = roster.length > 0 && roster.every((member) => selectedMemberIds.has(member.id));

    const toggleMember = (membershipId: number, checked: boolean) => {
        setSelectedMemberIds((current) => {
            const next = new Set(current);
            if (checked) next.add(membershipId);
            else next.delete(membershipId);
            return next;
        });
    };
    const toggleVisible = () => {
        setSelectedMemberIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) roster.forEach((member) => next.delete(member.id));
            else roster.forEach((member) => next.add(member.id));
            return next;
        });
    };
    const save = async () => {
        try {
            setSaving(true);
            await OrganizationService.replaceTeamMembers(team.id, [...selectedMemberIds]);
            await onSaved();
            toast.success(copy.members_updated);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.members_update_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent compact className="max-h-[90dvh] max-w-2xl overflow-y-auto">
                <div className="min-w-0 space-y-4">
                    <DialogHeader>
                        <DialogTitle>{copy.members_title.replace("{name}", team.name)}</DialogTitle>
                        <DialogDescription>{copy.members_description}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.members_search} aria-label={copy.members_search} className="sm:max-w-sm" />
                        <Button type="button" variant="outline" size="sm" onClick={toggleVisible} disabled={roster.length === 0}>
                            {allVisibleSelected ? copy.clear_selection : copy.select_all}
                        </Button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{selectedMemberIds.size} {selectedMemberIds.size === 1 ? copy.member_selected_one : copy.member_selected_many}</p>
                    {roster.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-6 text-center text-sm text-[var(--text-muted)]">{copy.members_empty}</p>
                    ) : (
                        <div className="max-h-[min(48dvh,27rem)] space-y-1 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-2">
                            {roster.map((member) => {
                                const isSelected = selectedMemberIds.has(member.id);
                                const displayName = member.is_anonymized
                                    ? dict.organization.people.erased_person
                                    : member.full_name || member.email;
                                return (
                                    <Label
                                        key={member.id}
                                        htmlFor={`team-member-${member.id}`}
                                        className={cn(
                                            "w-full cursor-pointer rounded-lg border px-2.5 py-2 transition-colors",
                                            isSelected
                                                ? "border-[color:var(--accent-color)]/60 bg-accent/10"
                                                : "border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)]/45",
                                        )}
                                    >
                                        <Field orientation="horizontal" className="min-w-0 items-center gap-3">
                                            <Checkbox id={`team-member-${member.id}`} checked={isSelected} onCheckedChange={(checked) => toggleMember(member.id, checked === true)} />
                                            <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-main)]">
                                                <span>{displayName}</span>
                                                <span className="hidden text-xs font-normal text-[var(--text-muted)] sm:inline"> · {member.email}</span>
                                            </div>
                                            <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                                                {dict.organization.access[member.access_class]}
                                            </span>
                                            {member.status !== "active" && <Badge variant="outline" className="border-[color:var(--text-muted)]/45 text-[var(--text-muted)]">{dict.organization.access[member.status]}</Badge>}
                                        </Field>
                                    </Label>
                                );
                            })}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="button" onClick={() => void save()} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {dict.organization.actions.save}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
