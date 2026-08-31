"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Building2, Layers3, Loader2, Pencil, Plus, Power, ShieldCheck, Trash2, UserMinus, UserPlus, UsersRound } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { MemberAccessDialog } from "@/components/organization/MemberAccessDialog";
import { PendingInvitationsPanel } from "@/components/organization/PendingInvitationsPanel";
import { OrganizationDepartmentsPanel } from "@/components/organization/OrganizationDepartmentsPanel";
import { OrganizationInvitePersonDialog } from "@/components/organization/OrganizationInvitePersonDialog";
import { OrganizationTableFilters } from "@/components/organization/OrganizationTableFilters";
import { OrganizationTeamsPanel } from "@/components/organization/OrganizationTeamsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLegend, FieldSet } from "@/components/ui/field";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErrorMessage } from "@/lib/errors";
import {
    filterOrganizationMembers,
    filterPermissionProfiles,
    isHistoricalOrganizationMember,
    type MemberFilters,
    type PermissionProfileFilters,
} from "@/lib/organization-filters";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import {
    OrganizationService,
    type OrganizationDepartment,
    type OrganizationMember,
    type OrganizationTeam,
    type PermissionDefinition,
    type PermissionProfile,
} from "@/services/organization.service";
import { RoleService, type Role } from "@/services/role.service";
import { UserService, type UserInvitation } from "@/services/user.service";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

type OrganizationTab = "people" | "departments" | "teams" | "profiles";
type CreateKind = "department" | "team" | "profile" | null;
const ORGANIZATION_PAGE_SIZE = 20;

type OrganizationData = {
    members: OrganizationMember[];
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
    definitions: PermissionDefinition[];
    profiles: PermissionProfile[];
    invitations: UserInvitation[];
};

const EMPTY_DATA: OrganizationData = {
    members: [], departments: [], teams: [], definitions: [], profiles: [], invitations: [],
};
export function OrganizationControlCenter() {
    const { dict } = useDictionary();
    const copy = dict.organization;
    const { user, loading: userLoading } = useUser();
    const [data, setData] = useState<OrganizationData>(EMPTY_DATA);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [tab, setTab] = useState<OrganizationTab>("people");
    const [createKind, setCreateKind] = useState<CreateKind>(null);
    const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [invitationRoles, setInvitationRoles] = useState<Role[]>([]);
    const [loadingInvitationRoles, setLoadingInvitationRoles] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<OrganizationMember | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [profileToEdit, setProfileToEdit] = useState<PermissionProfile | null>(null);
    const [profileToDelete, setProfileToDelete] = useState<PermissionProfile | null>(null);
    const [profileStatusTarget, setProfileStatusTarget] = useState<PermissionProfile | null>(null);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    const companyId = user?.company_id ?? null;
    const canInvitePeople = user?.role?.name === "admin" || user?.role?.name === "manager";
    const canRemovePeople = user?.role?.name === "admin";
    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const [members, departments, teams, definitions, profiles, invitations] = await Promise.all([
                OrganizationService.getMembers(),
                OrganizationService.getDepartments(),
                OrganizationService.getTeams(),
                OrganizationService.getPermissionDefinitions(),
                OrganizationService.getPermissionProfiles(),
                canInvitePeople
                    ? UserService.getInvitations()
                    : Promise.resolve([] as UserInvitation[]),
            ]);
            setData({ members, departments, teams, definitions, profiles, invitations });
        } catch (error) {
            setLoadError(getErrorMessage(error, copy.load_error));
        } finally {
            setLoading(false);
        }
    }, [canInvitePeople, companyId, copy.load_error]);
    const loadEvent = useEffectEvent(load);

    useEffect(() => {
        if (!userLoading) startTransition(() => { void loadEvent(); });
    }, [userLoading]);

    const actionLabel = useMemo(() => ({
        people: copy.actions.invite_person,
        departments: copy.actions.add_department,
        teams: copy.actions.add_team,
        profiles: copy.actions.create_profile,
    })[tab], [copy.actions, tab]);

    const openInvitation = async () => {
        try {
            setLoadingInvitationRoles(true);
            const roles = await RoleService.getRoles();
            const availableRoles = roles.filter((role) => role.is_active && ["admin", "manager", "viewer"].includes(role.name));
            if (availableRoles.length === 0) {
                toast.error(copy.people.invite_roles_unavailable);
                return;
            }
            setInvitationRoles(availableRoles);
            setInviteDialogOpen(true);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.people.invite_prepare_error));
        } finally {
            setLoadingInvitationRoles(false);
        }
    };

    const removeMember = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await OrganizationService.removeMember(deleteTarget.id);
            setSelectedMember(null);
            setDeleteTarget(null);
            await load();
            toast.success(copy.people.remove_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.people.remove_error));
        } finally {
            setDeleting(false);
        }
    };

    const deletePermissionProfile = async () => {
        if (!profileToDelete) return;
        try {
            setUpdatingProfile(true);
            await OrganizationService.deletePermissionProfile(profileToDelete.id);
            setProfileToDelete(null);
            await load();
            toast.success(copy.profiles.delete_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.profiles.delete_error));
        } finally {
            setUpdatingProfile(false);
        }
    };

    const updatePermissionProfileStatus = async () => {
        if (!profileStatusTarget) return;
        try {
            setUpdatingProfile(true);
            await OrganizationService.updatePermissionProfile(profileStatusTarget.id, {
                is_active: !profileStatusTarget.is_active,
            });
            setProfileStatusTarget(null);
            await load();
            toast.success(copy.profiles.status_updated);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.profiles.status_update_error));
        } finally {
            setUpdatingProfile(false);
        }
    };

    const openAction = () => {
        if (tab === "people") {
            void openInvitation();
            return;
        }
        setCreateKind(tab === "departments" ? "department" : tab === "teams" ? "team" : "profile");
    };

    if (!companyId && !userLoading) {
        return <RestrictedOrganizationState message={copy.configuration_unavailable} />;
    }

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Building2}
                title={copy.title}
                subtitle={copy.subtitle}
                className="mb-7"
                actions={(
                    <Button
                        type="button"
                        onClick={openAction}
                        disabled={loadingInvitationRoles || (tab === "people" && !canInvitePeople)}
                        title={tab === "people" && !canInvitePeople ? copy.people.invite_permission : undefined}
                    >
                        {tab === "people" ? <UserPlus className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {loadingInvitationRoles && tab === "people" ? copy.actions.preparing : actionLabel}
                    </Button>
                )}
            />

            <PremiumTabs<OrganizationTab>
                className="mb-6"
                layout="fit"
                tabs={[
                    { id: "people", label: copy.tabs.people, compactLabel: copy.tabs.people_compact, icon: UsersRound },
                    { id: "departments", label: copy.tabs.departments, compactLabel: copy.tabs.departments_compact, icon: Building2 },
                    { id: "teams", label: copy.tabs.teams, compactLabel: copy.tabs.teams_compact, icon: Layers3 },
                    { id: "profiles", label: copy.tabs.profiles, compactLabel: copy.tabs.profiles_compact, icon: ShieldCheck },
                ]}
                activeTab={tab}
                onChange={setTab}
            />

            {loading ? <LoadingState /> : loadError ? <RestrictedOrganizationState message={loadError} /> : (
                <>
                    {tab === "people" && <MembersTable members={data.members} departments={data.departments} teams={data.teams} invitations={data.invitations} onInvitationChanged={load} onSelect={setSelectedMember} onDelete={setDeleteTarget} canDelete={canRemovePeople} currentUserId={user?.id} />}
                    {tab === "departments" && <OrganizationDepartmentsPanel departments={data.departments} onChanged={load} />}
                    {tab === "teams" && <OrganizationTeamsPanel teams={data.teams} departments={data.departments} members={data.members} onChanged={load} />}
                    {tab === "profiles" && (
                        <ProfilesTable
                            profiles={data.profiles}
                            definitions={data.definitions}
                            onEdit={setProfileToEdit}
                            onRequestStatusChange={setProfileStatusTarget}
                            onRequestDelete={setProfileToDelete}
                        />
                    )}
                </>
            )}

            <CreateOrganizationDialog
                key={profileToEdit ? `profile-${profileToEdit.id}` : createKind ?? "closed"}
                kind={createKind}
                profile={profileToEdit}
                departments={data.departments}
                definitions={data.definitions}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreateKind(null);
                        setProfileToEdit(null);
                    }
                }}
                onCreated={async () => {
                    setCreateKind(null);
                    setProfileToEdit(null);
                    await load();
                }}
            />
            {companyId && (
                <MemberAccessDialog
                    key={selectedMember?.id ?? "none"}
                    open={selectedMember !== null}
                    onOpenChange={(open) => !open && setSelectedMember(null)}
                    member={selectedMember}
                    companyId={companyId}
                    departments={data.departments}
                    teams={data.teams}
                    profiles={data.profiles}
                    onSaved={load}
                    canDelete={canRemovePeople && selectedMember?.user_id !== user?.id}
                    onRequestDelete={() => selectedMember && setDeleteTarget(selectedMember)}
                />
            )}
            {inviteDialogOpen && (
                <OrganizationInvitePersonDialog
                    open
                    onOpenChange={setInviteDialogOpen}
                    roles={invitationRoles}
                    onSent={load}
                />
            )}
            <DeleteConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title={copy.people.remove_title}
                description={copy.people.remove_description.replace("{email}", deleteTarget?.email || "")}
                onConfirm={() => void removeMember()}
                isDeleting={deleting}
                confirmText={copy.people.remove_confirm}
                cancelText={copy.actions.cancel}
            />
            <DeleteConfirmDialog
                open={profileToDelete !== null}
                onOpenChange={(open) => !open && setProfileToDelete(null)}
                title={copy.profiles.delete_title}
                description={copy.profiles.delete_description}
                onConfirm={() => void deletePermissionProfile()}
                isDeleting={updatingProfile}
                confirmText={copy.actions.delete}
                cancelText={copy.actions.cancel}
            />
            <DeleteConfirmDialog
                open={profileStatusTarget !== null}
                onOpenChange={(open) => !open && setProfileStatusTarget(null)}
                title={profileStatusTarget?.is_active ? copy.profiles.deactivate_title : copy.profiles.reactivate_title}
                description={profileStatusTarget?.is_active ? copy.profiles.deactivate_description : copy.profiles.reactivate_description}
                onConfirm={() => void updatePermissionProfileStatus()}
                isDeleting={updatingProfile}
                confirmText={profileStatusTarget?.is_active ? copy.profiles.deactivate_confirm : copy.profiles.reactivate_confirm}
                cancelText={copy.actions.cancel}
                confirmIcon={Power}
                confirmVariant={profileStatusTarget?.is_active ? "soft-danger" : "primary"}
            />
        </div>
    );
}

function MembersTable({
    members,
    departments,
    teams,
    invitations,
    onInvitationChanged,
    onSelect,
    onDelete,
    canDelete,
    currentUserId,
}: {
    members: OrganizationMember[];
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
    invitations: UserInvitation[];
    onInvitationChanged: () => Promise<void>;
    onSelect: (member: OrganizationMember) => void;
    onDelete: (member: OrganizationMember) => void;
    canDelete: boolean;
    currentUserId?: number;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.people;
    const [filters, setFilters] = useState<MemberFilters>({
        search: "",
        accessClass: "all",
        status: "all",
    });
    const filteredMembers = useMemo(
        () => filterOrganizationMembers(members, filters),
        [members, filters],
    );
    const activeMembers = filteredMembers.filter((member) => !isHistoricalOrganizationMember(member) && member.status === "active");
    const suspendedMembers = filteredMembers.filter((member) => !isHistoricalOrganizationMember(member) && member.status === "suspended");
    const historicalMembers = filteredMembers.filter(isHistoricalOrganizationMember);
    const hasActiveFilters = filters.search.trim() !== "" || filters.accessClass !== "all" || filters.status !== "all";
    const updateFilters = (update: Partial<MemberFilters>) => {
        setFilters((current) => ({ ...current, ...update }));
    };
    const clearFilters = () => {
        setFilters({ search: "", accessClass: "all", status: "all" });
    };
    return (
        <div className="space-y-6">
            <PendingInvitationsPanel invitations={invitations} onChanged={onInvitationChanged} />
            <section className="billing-surface overflow-hidden rounded-[26px]">
                <OrganizationTableFilters
                    search={filters.search}
                    onSearchChange={(search) => updateFilters({ search })}
                    searchPlaceholder={dict.organization.filters.search_people}
                    shownCount={filteredMembers.length}
                    totalCount={members.length}
                    summary={dict.organization.filters.summary}
                    clearLabel={dict.organization.filters.clear}
                    onClear={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                >
                    <Select value={filters.accessClass} onValueChange={(accessClass) => updateFilters({ accessClass: accessClass as MemberFilters["accessClass"] })}>
                        <SelectTrigger className="h-10 w-full sm:w-44" aria-label={copy.columns.type}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{dict.organization.filters.all_access_classes}</SelectItem>
                            <SelectItem value="admin">{dict.organization.access.admin}</SelectItem>
                            <SelectItem value="responsible">{dict.organization.access.responsible}</SelectItem>
                            <SelectItem value="worker">{dict.organization.access.worker}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filters.status} onValueChange={(status) => updateFilters({ status: status as MemberFilters["status"] })}>
                        <SelectTrigger className="h-10 w-full sm:w-44" aria-label={copy.columns.status}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{dict.organization.filters.all_statuses}</SelectItem>
                            <SelectItem value="active">{dict.organization.access.active}</SelectItem>
                            <SelectItem value="suspended">{dict.organization.access.suspended}</SelectItem>
                            <SelectItem value="archived">{dict.organization.access.archived}</SelectItem>
                        </SelectContent>
                    </Select>
                </OrganizationTableFilters>
            </section>
            {filteredMembers.length === 0 && members.length > 0 ? (
                <OrganizationFilterEmptyState message={dict.organization.filters.empty} />
            ) : (
                <>
                    {(activeMembers.length > 0 || members.length === 0) && (
                        <CurrentMembersTable
                            members={activeMembers}
                            title={copy.active_title}
                            subtitle={copy.active_description}
                            empty={copy.active_empty}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            canDelete={canDelete}
                            currentUserId={currentUserId}
                        />
                    )}
                    {suspendedMembers.length > 0 && (
                <CurrentMembersTable
                    members={suspendedMembers}
                    title={copy.suspended_title}
                    subtitle={copy.suspended_description}
                    empty=""
                    onSelect={onSelect}
                    onDelete={onDelete}
                    canDelete={canDelete}
                    currentUserId={currentUserId}
                />
            )}
                    {historicalMembers.length > 0 && <MemberHistoryTable members={historicalMembers} departments={departments} teams={teams} />}
                </>
            )}
        </div>
    );
}

function CurrentMembersTable({
    members,
    title,
    subtitle,
    empty,
    onSelect,
    onDelete,
    canDelete,
    currentUserId,
}: {
    members: OrganizationMember[];
    title: string;
    subtitle: string;
    empty: string;
    onSelect: (member: OrganizationMember) => void;
    onDelete: (member: OrganizationMember) => void;
    canDelete: boolean;
    currentUserId?: number;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.people;
    const pagination = useDataTablePagination(members, ORGANIZATION_PAGE_SIZE);
    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{members.length} {members.length === 1 ? copy.person_count_one : copy.person_count_many}</p>
            </header>
            {members.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{empty}</p>
            ) : (
                <>
                <Table className="table-fixed text-left">
                    <TableHeader>
                        <TableRow className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            <TableHead className="w-[58%] text-[var(--btn-secondary-text)] xl:w-[48%] 2xl:w-[34%]">{copy.columns.person}</TableHead>
                            <TableHead className="hidden text-[var(--btn-secondary-text)] xl:table-cell xl:w-[23%] 2xl:w-[17%]">{copy.columns.type}</TableHead>
                            <TableHead className="w-[26%] text-[var(--btn-secondary-text)] xl:w-[18%] 2xl:w-[15%]">{copy.columns.status}</TableHead>
                            <TableHead className="hidden text-[var(--btn-secondary-text)] 2xl:table-cell 2xl:w-[24%]">{copy.columns.profiles}</TableHead>
                            <TableHead className="w-[16%] text-right text-[var(--btn-secondary-text)] xl:w-[11%] 2xl:w-[10%]">{copy.columns.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {pagination.pageItems.map((member) => (
                            <CurrentMemberRow
                                key={member.id}
                                member={member}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                canDelete={canDelete && member.user_id !== currentUserId}
                            />
                        ))}
                </TableBody>
            </Table>
            <OrganizationTablePagination pagination={pagination} totalItems={members.length} />
                </>
        )}
        </section>
    );
}

function CurrentMemberRow({
    member,
    onSelect,
    onDelete,
    canDelete,
}: {
    member: OrganizationMember;
    onSelect: (member: OrganizationMember) => void;
    onDelete: (member: OrganizationMember) => void;
    canDelete: boolean;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization;
    const accessLabel = copy.access[member.access_class];
    const profileText = member.profile_assignments.map((assignment) => assignment.permission_profile_name).join(", ") || copy.people.no_additional_profile;
    const memberName = member.full_name || member.email;
    const actionOptions: PopoverOption[] = [
        { label: copy.actions.edit, icon: Pencil, variant: "edit", onClick: () => onSelect(member) },
        ...(canDelete
            ? [{ label: copy.people.remove_action, icon: UserMinus, variant: "delete" as const, onClick: () => onDelete(member) }]
            : []),
    ];
    return (
        <TableRow
            className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/20 last:border-b-0"
            onClick={() => onSelect(member)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(member);
                }
            }}
            tabIndex={0}
            aria-label={copy.people.configure_access.replace("{name}", memberName)}
        >
            <TableCell>
                <p className="truncate font-semibold text-[var(--text-main)]">{member.full_name || member.email}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{member.email}</p>
                <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)] xl:hidden">{accessLabel}</p>
            </TableCell>
            <TableCell className="hidden xl:table-cell"><p className="text-sm font-medium text-[var(--text-main)]">{accessLabel}</p></TableCell>
            <TableCell><StatusBadge status={member.status} /></TableCell>
            <TableCell className="hidden 2xl:table-cell"><p className="truncate text-sm text-[var(--text-muted)]">{profileText}</p></TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <ActionPopover align="end" triggerLabel={`${copy.actions.edit}: ${memberName}`} options={actionOptions} />
            </TableCell>
        </TableRow>
    );
}

function StatusBadge({ status }: { status: OrganizationMember["status"] | "inactive" }) {
    const { dict } = useDictionary();
    return <Badge variant="outline" className={status === "active" ? "border-accent/60 bg-accent/10 text-accent" : "border-[color:var(--text-muted)]/45 text-[var(--text-muted)]"}>{dict.organization.access[status]}</Badge>;
}

function MemberHistoryTable({
    members,
    departments,
    teams,
}: {
    members: OrganizationMember[];
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
}) {
    const { dict, locale } = useDictionary();
    const copy = dict.organization;
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }),
        [locale],
    );
    const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
    const teamNames = new Map(teams.map((team) => [team.id, team.name]));
    const pagination = useDataTablePagination(members, ORGANIZATION_PAGE_SIZE);
    return (
        <section className="overflow-hidden rounded-[26px] border border-[var(--border-soft)] bg-[var(--bg-card)]/50">
            <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{copy.people.history_title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.people.history_description}</p>
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{members.length} {members.length === 1 ? copy.people.record_count_one : copy.people.record_count_many}</p>
            </header>
            <Table className="table-fixed text-left">
                <TableHeader>
                    <TableRow className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        <TableHead className="w-[48%] text-[var(--btn-secondary-text)] sm:w-[34%]">{copy.people.columns.record}</TableHead>
                        <TableHead className="w-[27%] text-[var(--btn-secondary-text)] sm:w-[20%]">{copy.people.columns.departure_date}</TableHead>
                        <TableHead className="w-[25%] text-[var(--btn-secondary-text)] sm:w-[18%]">{copy.people.columns.previous_type}</TableHead>
                        <TableHead className="hidden text-[var(--btn-secondary-text)] sm:table-cell sm:w-[28%]">{copy.people.columns.retention}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pagination.pageItems.map((member) => {
                        const erased = member.is_anonymized || (member.email.startsWith("deleted+") && member.email.endsWith("@invalid.workhive.local"));
                        const structure = [
                            ...member.department_ids.flatMap((id) => {
                                const name = departmentNames.get(id);
                                return name ? [name] : [];
                            }),
                            ...member.team_ids.flatMap((id) => {
                                const name = teamNames.get(id);
                                return name ? [name] : [];
                            }),
                        ].join(", ") || copy.people.no_structure;
                        return (
                            <TableRow key={member.id} className="bg-[var(--bg-secondary)]/10 last:border-b-0">
                                <TableCell>
                                    <p className="truncate font-semibold text-[var(--text-main)]">{erased ? copy.people.erased_person : member.full_name || member.email}</p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{erased ? copy.people.erased_email : member.email}</p>
                                </TableCell>
                                <TableCell><p className="text-sm text-[var(--text-muted)]">{member.ended_at ? dateFormatter.format(new Date(member.ended_at)) : copy.people.history_date_unknown}</p></TableCell>
                                <TableCell><p className="text-sm font-medium text-[var(--text-main)]">{copy.access[member.access_class]}</p></TableCell>
                                <TableCell className="hidden sm:table-cell"><p className="truncate text-sm text-[var(--text-muted)]">{structure}</p></TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            <OrganizationTablePagination pagination={pagination} totalItems={members.length} />
        </section>
    );
}

function permissionLabel(
    code: string,
    definition: PermissionDefinition | undefined,
    copy: ReturnType<typeof useDictionary>["dict"]["organization"],
) {
    const labels = copy.profiles.permission_catalog as Record<string, string>;
    return labels[code] || (definition?.description !== code ? definition?.description : undefined) || labels.unknown;
}

function permissionSummary(
    profile: PermissionProfile,
    definitionByCode: Map<string, PermissionDefinition>,
    copy: ReturnType<typeof useDictionary>["dict"]["organization"],
) {
    const labels = profile.permission_codes.map((code) => permissionLabel(code, definitionByCode.get(code), copy));
    const visible = labels.slice(0, 2).join(", ");
    const remaining = labels.length - 2;
    return remaining > 0 ? `${visible} ${copy.profiles.and_more.replace("{count}", String(remaining))}` : visible;
}

function ProfilesTable({
    profiles,
    definitions,
    onEdit,
    onRequestStatusChange,
    onRequestDelete,
}: {
    profiles: PermissionProfile[];
    definitions: PermissionDefinition[];
    onEdit: (profile: PermissionProfile) => void;
    onRequestStatusChange: (profile: PermissionProfile) => void;
    onRequestDelete: (profile: PermissionProfile) => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization;
    const definitionByCode = useMemo(
        () => new Map(definitions.map((definition) => [definition.code, definition])),
        [definitions],
    );
    const [filters, setFilters] = useState<PermissionProfileFilters>({
        search: "",
        type: "all",
        status: "all",
    });
    const filteredProfiles = useMemo(
        () => filterPermissionProfiles(profiles, filters),
        [profiles, filters],
    );
    const pagination = useDataTablePagination(filteredProfiles, ORGANIZATION_PAGE_SIZE);
    const hasActiveFilters = filters.search.trim() !== "" || filters.type !== "all" || filters.status !== "all";
    const updateFilters = (update: Partial<PermissionProfileFilters>) => {
        setFilters((current) => ({ ...current, ...update }));
        pagination.setPage(1);
    };
    const clearFilters = () => {
        setFilters({ search: "", type: "all", status: "all" });
        pagination.setPage(1);
    };
    return (
        <OrganizationTableShell
            title={copy.profiles.title}
            description={copy.profiles.description}
            countLabel={`${filteredProfiles.length} ${filteredProfiles.length === 1 ? copy.profiles.count_one : copy.profiles.count_many}`}
        >
            <OrganizationTableFilters
                search={filters.search}
                onSearchChange={(search) => updateFilters({ search })}
                searchPlaceholder={copy.filters.search_profiles}
                shownCount={filteredProfiles.length}
                totalCount={profiles.length}
                summary={copy.filters.summary}
                clearLabel={copy.filters.clear}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
            >
                <Select value={filters.type} onValueChange={(type) => updateFilters({ type: type as PermissionProfileFilters["type"] })}>
                    <SelectTrigger className="h-10 w-full sm:w-52" aria-label={copy.people.columns.type}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{copy.filters.all_profile_types}</SelectItem>
                        <SelectItem value="system">{copy.filters.system_profiles}</SelectItem>
                        <SelectItem value="custom">{copy.filters.custom_profiles}</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(status) => updateFilters({ status: status as PermissionProfileFilters["status"] })}>
                    <SelectTrigger className="h-10 w-full sm:w-44" aria-label={copy.people.columns.status}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{copy.filters.all_statuses}</SelectItem>
                        <SelectItem value="active">{copy.access.active}</SelectItem>
                        <SelectItem value="inactive">{copy.access.inactive}</SelectItem>
                    </SelectContent>
                </Select>
            </OrganizationTableFilters>
            {filteredProfiles.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{profiles.length === 0 ? copy.profiles.empty : copy.filters.empty}</p>
            ) : (
                <>
            <Table className="table-fixed text-left">
                <TableHeader>
                    <TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        <TableHead className="w-[58%] text-[var(--btn-secondary-text)] sm:w-[32%]">{copy.profiles.profile}</TableHead>
                        <TableHead className="hidden text-[var(--btn-secondary-text)] lg:table-cell lg:w-[28%]">{copy.profiles.permissions}</TableHead>
                        <TableHead className="w-[22%] text-[var(--btn-secondary-text)] sm:w-[15%]">{copy.people.columns.type}</TableHead>
                        <TableHead className="hidden text-[var(--btn-secondary-text)] sm:table-cell sm:w-[15%]">{copy.people.columns.status}</TableHead>
                        <TableHead className="w-[20%] text-right text-[var(--btn-secondary-text)] sm:w-[10%]">{copy.profiles.actions}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pagination.pageItems.map((profile) => {
                        const canManage = !profile.is_system;
                        const summary = permissionSummary(profile, definitionByCode, copy);
                        const actionOptions: PopoverOption[] = canManage ? [
                            { label: copy.actions.edit, icon: Pencil, variant: "edit", onClick: () => onEdit(profile) },
                            {
                                label: profile.is_active ? copy.profiles.deactivate : copy.profiles.reactivate,
                                icon: Power,
                                variant: profile.is_active ? "deactivate" : "default",
                                onClick: () => onRequestStatusChange(profile),
                            },
                            ...((profile.usage?.can_delete ?? false) ? [{ label: copy.actions.delete, icon: Trash2, variant: "delete" as const, onClick: () => onRequestDelete(profile) }] : []),
                        ] : [];
                        return (
                        <TableRow
                            key={profile.id}
                            className="bg-[var(--bg-secondary)]/20 last:border-b-0"
                            onClick={canManage ? () => onEdit(profile) : undefined}
                            onKeyDown={(event) => {
                                if (canManage && (event.key === "Enter" || event.key === " ")) {
                                    event.preventDefault();
                                    onEdit(profile);
                                }
                            }}
                            tabIndex={canManage ? 0 : undefined}
                            aria-label={canManage ? `${copy.actions.edit} ${profile.name}` : undefined}
                        >
                            <TableCell>
                                <p className="truncate font-semibold text-[var(--text-main)]">{profile.name}</p>
                                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{profile.description || copy.profiles.no_description}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)] lg:hidden">{profile.permission_codes.length} {profile.permission_codes.length === 1 ? copy.profiles.permission_count_one : copy.profiles.permission_count_many} · {summary}</p>
                            </TableCell>
                            <TableCell className="hidden text-sm text-[var(--text-muted)] lg:table-cell"><p className="line-clamp-2">{summary}</p></TableCell>
                            <TableCell><Badge variant="outline" className={profile.is_system ? "border-[color:var(--text-muted)]/45 text-[var(--text-muted)]" : "border-[color:var(--btn-secondary-text)]/45 text-[var(--btn-secondary-text)]"}>{profile.is_system ? copy.profiles.system : copy.profiles.custom}</Badge></TableCell>
                            <TableCell className="hidden sm:table-cell"><StatusBadge status={profile.is_active ? "active" : "inactive"} /></TableCell>
                            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                {canManage ? (
                                    <ActionPopover align="end" triggerLabel={`${copy.profiles.actions}: ${profile.name}`} options={actionOptions} />
                                ) : (
                                    <span className="inline-flex text-[var(--text-muted)]" title={copy.profiles.system_managed} aria-label={copy.profiles.system_managed}>
                                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            <OrganizationTablePagination pagination={pagination} totalItems={filteredProfiles.length} />
                </>
            )}
        </OrganizationTableShell>
    );
}

function OrganizationTablePagination({
    pagination,
    totalItems,
}: {
    pagination: ReturnType<typeof useDataTablePagination>;
    totalItems: number;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.pagination;
    const from = (pagination.page - 1) * pagination.pageSize + 1;
    const to = Math.min(pagination.page * pagination.pageSize, totalItems);
    return <DataTablePagination
        page={pagination.page}
        totalItems={totalItems}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        summary={copy.summary.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(totalItems))}
        rowsPerPageLabel={copy.rows_per_page}
        previousLabel={copy.previous}
        nextLabel={copy.next}
    />;
}

function OrganizationTableShell({
    title,
    description,
    countLabel,
    children,
}: {
    title: string;
    description: string;
    countLabel: string;
    children: React.ReactNode;
}) {
    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{countLabel}</p>
            </header>
            {children}
        </section>
    );
}

function OrganizationFilterEmptyState({ message }: { message: string }) {
    return <section className="billing-surface rounded-[26px] px-5 py-16 text-center text-sm text-[var(--text-muted)]">{message}</section>;
}

function CreateOrganizationDialog({
    kind,
    profile,
    departments,
    definitions,
    onOpenChange,
    onCreated,
}: {
    kind: CreateKind;
    profile: PermissionProfile | null;
    departments: OrganizationDepartment[];
    definitions: PermissionDefinition[];
    onOpenChange: (open: boolean) => void;
    onCreated: () => Promise<void>;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.create_dialog;
    const profileCopy = dict.organization.profiles;
    const isProfile = kind === "profile" || profile !== null;
    const [name, setName] = useState(profile?.name ?? "");
    const [code, setCode] = useState("");
    const [departmentId, setDepartmentId] = useState<string>("");
    const [description, setDescription] = useState(profile?.description ?? "");
    const [permissionCodes, setPermissionCodes] = useState<string[]>(profile?.permission_codes ?? []);
    const [saving, setSaving] = useState(false);
    const selectedPermissionCodeSet = useMemo(
        () => new Set(permissionCodes),
        [permissionCodes],
    );
    const activeDepartments = useMemo(
        () => departments.filter((department) => department.is_active),
        [departments],
    );
    const definitionsByCategory = useMemo(() => {
        const grouped = new Map<string, PermissionDefinition[]>();
        for (const definition of definitions) {
            grouped.set(definition.category, [...(grouped.get(definition.category) ?? []), definition]);
        }
        return [...grouped.entries()];
    }, [definitions]);
    const toggleCategory = (categoryDefinitions: PermissionDefinition[]) => {
        const codes = categoryDefinitions.map((definition) => definition.code);
        const codeSet = new Set(codes);
        const allSelected = codes.every((permissionCode) => selectedPermissionCodeSet.has(permissionCode));
        setPermissionCodes((current) => allSelected
            ? current.filter((permissionCode) => !codeSet.has(permissionCode))
            : [...new Set([...current, ...codes])],
        );
    };

    const title = profile ? profileCopy.edit_title : kind === "department" ? copy.new_department : kind === "team" ? copy.new_team : copy.new_profile;
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            if (kind === "department") await OrganizationService.createDepartment({
                name,
                code: code || undefined,
                parent_department_id: departmentId && departmentId !== "none" ? Number(departmentId) : undefined,
            });
            if (kind === "team") await OrganizationService.createTeam({ name, code: code || undefined, department_id: departmentId ? Number(departmentId) : undefined });
            if (profile) await OrganizationService.updatePermissionProfile(profile.id, {
                name,
                description: description || null,
                permission_codes: permissionCodes,
            });
            if (kind === "profile" && !profile) await OrganizationService.createPermissionProfile({ name, description: description || undefined, permission_codes: permissionCodes });
            await onCreated();
            toast.success(profile ? profileCopy.updated : copy.saved);
        } catch (error) {
            toast.error(getErrorMessage(error, profile ? profileCopy.update_error : copy.save_error));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={kind !== null || profile !== null} onOpenChange={onOpenChange}>
            <DialogContent className="permission-profile-dialog max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0">
                <form onSubmit={handleSubmit} className="min-w-0">
                    <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{profile ? profileCopy.edit_description : isProfile ? copy.profile_description : copy.structure_description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 px-5 py-4 sm:px-6">
                        <div className="space-y-2">
                            <Label htmlFor="organization-name">{copy.name}</Label>
                            <Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} required />
                        </div>
                        {!isProfile && (
                            <div className="space-y-2">
                                <Label htmlFor="organization-code">{copy.code_optional}</Label>
                                <Input id="organization-code" value={code} onChange={(event) => setCode(event.target.value)} />
                            </div>
                        )}
                        {kind === "department" && (
                            <div className="space-y-2">
                                <Label>{copy.parent_department_optional}</Label>
                                <Select value={departmentId || "none"} onValueChange={setDepartmentId}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{copy.no_parent_department}</SelectItem>
                                        {activeDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {kind === "team" && (
                            <div className="space-y-2">
                                <Label>{copy.department_optional}</Label>
                                <Select value={departmentId} onValueChange={setDepartmentId}>
                                    <SelectTrigger><SelectValue placeholder={copy.no_department} /></SelectTrigger>
                                    <SelectContent>
                                        {activeDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {isProfile && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="organization-description">{copy.description_optional}</Label>
                                    <Input id="organization-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                                </div>
                                <FieldSet className="gap-2">
                                    <FieldLegend variant="label" className="mb-0 text-[var(--text-main)]">{copy.permissions}</FieldLegend>
                                    <div className="max-h-[min(42dvh,23rem)] space-y-2 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-2">
                                        {definitionsByCategory.map(([category, categoryDefinitions]) => (
                                            <section key={category} className="space-y-1">
                                                <div className="flex min-h-7 items-center justify-between gap-3 px-0.5">
                                                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--btn-secondary-text)]">
                                                        {(profileCopy.permission_categories as Record<string, string>)[category] || category}
                                                    </h3>
                                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-[var(--btn-secondary-text)] hover:text-[var(--btn-secondary-hover-text)]" onClick={() => toggleCategory(categoryDefinitions)}>
                                                        {categoryDefinitions.every((definition) => selectedPermissionCodeSet.has(definition.code)) ? profileCopy.clear_category : profileCopy.select_category}
                                                    </Button>
                                                </div>
                                                <div className="space-y-1">
                                                    {categoryDefinitions.map((definition) => {
                                                        const isSelected = selectedPermissionCodeSet.has(definition.code);
                                                        return (
                                                            <Label
                                                                key={definition.id}
                                                                htmlFor={`definition-${definition.id}`}
                                                                className={cn(
                                                                    "w-full cursor-pointer rounded-lg border px-2.5 py-2 transition-colors",
                                                                    isSelected
                                                                        ? "border-[color:var(--accent-color)]/60 bg-accent/10"
                                                                        : "border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)]/45",
                                                                )}
                                                            >
                                                                <Field orientation="horizontal" className="items-center gap-3">
                                                                    <Checkbox
                                                                        id={`definition-${definition.id}`}
                                                                        checked={isSelected}
                                                                        onCheckedChange={(checked) => setPermissionCodes((current) => checked === true ? [...current, definition.code] : current.filter((item) => item !== definition.code))}
                                                                    />
                                                                    <span className="min-w-0 flex-1 text-xs leading-4 font-medium text-[var(--text-main)]">
                                                                        {permissionLabel(definition.code, definition, dict.organization)}
                                                                    </span>
                                                                </Field>
                                                            </Label>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                </FieldSet>
                            </>
                        )}
                    </div>
                    <DialogFooter className="dialog-glass-chrome border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || (isProfile && permissionCodes.length === 0)}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {dict.organization.actions.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function LoadingState() {
    const { dict } = useDictionary();
    return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-accent" /><p className="text-sm text-[var(--text-muted)]">{dict.organization.loading}</p></div>;
}
function RestrictedOrganizationState({ message }: { message: string }) { return <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p></div>; }
