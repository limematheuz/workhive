"use client";

import { startTransition, useState, useEffect, useCallback, useEffectEvent } from "react";
import { Building2, Loader2, Trash2, UserPlus, Users } from "lucide-react";

import { CollaborationManagementPanel } from "@/components/collaborations/CollaborationManagementPanel";
import { CompanyInvitationDialog } from "@/components/collaborations/CompanyInvitationDialog";
import { TeamListSection } from "@/components/users/TeamListSection";
import { TeamInvitationChooserDialog } from "@/components/users/TeamInvitationChooserDialog";
import { UserCreateDialog } from "@/components/users/UserCreateDialog";
import { UserEditDialog } from "@/components/users/UserEditDialog";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { RoleService, Role } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import { User } from "@/types/user";
import { getUserDeletionErrorMessage } from "@/lib/user-deletion";
import { COMPANY_ASSIGNABLE_ROLE_NAMES } from "@/components/users/user-role-utils";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { DocumentFormSelect } from "@/components/billing/DocumentFormControls";

type EditDialogState = {
    open: boolean;
    user: User | null;
};

type DeleteDialogState = {
    target: User | null;
    submitting: boolean;
};

type TeamView = "people" | "companies";
type PeopleScope = "all" | "internal" | "external";

export default function TeamPage() {
    const { dict } = useDictionary();
    const { user: currentUser, loading: userLoading } = useUser();
    const [team, setTeam] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [catalogStatus, setCatalogStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [defaultRoleId, setDefaultRoleId] = useState<string>("");
    const [teamView, setTeamView] = useState<TeamView>("people");
    const [peopleScope, setPeopleScope] = useState<PeopleScope>("all");
    const [invitationChooserOpen, setInvitationChooserOpen] = useState(false);
    const [companyInvitationOpen, setCompanyInvitationOpen] = useState(false);
    const [companyInvitationRefreshKey, setCompanyInvitationRefreshKey] = useState(0);

    const [createOpen, setCreateOpen] = useState<boolean>(false);
    const [edit, setEdit] = useState<EditDialogState>({ open: false, user: null });
    const [deleteState, setDeleteState] = useState<DeleteDialogState>({
        target: null,
        submitting: false,
    });

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (new URLSearchParams(window.location.search).get("tab") === "companies") {
                setTeamView("companies");
            }
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

    const loading = userLoading || catalogStatus === "idle" || catalogStatus === "loading";

    const loadPageDataEvent = useEffectEvent(async () => {
        if (!currentUser) return;
        setCatalogStatus("loading");
        try {
            const [allRoles, users] = await Promise.all([
                RoleService.getRoles(),
                UserService.getUsers(),
            ]);
            setTeam(users);

            const cleanedRoles = allRoles.filter((r) =>
                COMPANY_ASSIGNABLE_ROLE_NAMES.includes(
                    r.name as typeof COMPANY_ASSIGNABLE_ROLE_NAMES[number],
                ),
            );
            const filteredRoles = currentUser.role?.name === "superadmin"
                ? cleanedRoles
                : cleanedRoles.filter((r) => r.name !== "superadmin");

            setRoles(filteredRoles);
            if (filteredRoles.length > 0) {
                setDefaultRoleId(filteredRoles[0].id.toString());
            }
            setCatalogStatus("ready");
        } catch (error) {
            console.error("Error loading team page data", error);
            toast.error(dict.users.error_update);
            setCatalogStatus("error");
        }
    });

    useEffect(() => {
        if (userLoading || !currentUser) return;
        if (catalogStatus !== "idle") return;
        startTransition(() => {
            void loadPageDataEvent();
        });
    }, [userLoading, currentUser, catalogStatus]);

    const refreshTeam = useCallback(async () => {
        try {
            const data = await UserService.getUsers();
            setTeam(data);
        } catch (error) {
            console.error("Error loading company users", error);
            toast.error(dict.users.error_update);
        }
    }, [dict.users.error_update]);

    const handleEditClick = (user: User) => {
        setEdit({ open: true, user });
    };

    const handleDeleteWorker = async () => {
        if (!deleteState.target) return;
        try {
            setDeleteState((current) => ({ ...current, submitting: true }));
            await UserService.deleteUser(deleteState.target.id);
            setTeam((prev) => prev.filter((member) => member.id !== deleteState.target!.id));
            setDeleteState({ target: null, submitting: false });
            toast.success(dict.users.delete_success);
        } catch (error: unknown) {
            toast.error(getUserDeletionErrorMessage(error, {
                blocked: dict.users.delete_blocked,
                fallback: dict.users.delete_error,
            }));
            setDeleteState((current) => ({ ...current, submitting: false }));
        }
    };

    const companyTeam = team.filter((member) => {
        if (!currentUser) return true;
        if (currentUser.role?.name === "superadmin") return true;
        return member.role?.name !== "superadmin";
    });
    const filteredTeam = companyTeam.filter((member) => {
        if (peopleScope === "all") return true;
        if (peopleScope === "external") return member.role?.name === "external_portal";
        return member.role?.name !== "external_portal";
    });

    const roleLabels = {
        role_superadmin: dict.users.role_superadmin,
        role_admin: dict.users.role_admin,
        role_external_portal: dict.users.role_external_portal,
        role_manager: dict.users.role_manager,
        role_installer: dict.users.role_installer,
        role_viewer: dict.users.role_viewer,
    };

    const openCompanyInvitation = () => setCompanyInvitationOpen(true);

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Users}
                title={dict.users.list_title}
                subtitle={dict.users.team_page_subtitle}
                className="mb-8"
                actions={(
                    <button
                        type="button"
                        onClick={() => setInvitationChooserOpen(true)}
                        className={`${PAGE_ACTION_BUTTON_PRIMARY} cursor-pointer`}
                    >
                        <UserPlus className="w-4 h-4" />
                        {dict.users.invite}
                    </button>
                )}
            />

            <PremiumTabs
                className="mb-5"
                tabs={[
                    { id: "people", label: dict.users.people, icon: Users },
                    { id: "companies", label: dict.users.partner_companies, icon: Building2 },
                ]}
                activeTab={teamView}
                onChange={setTeamView}
            />

            {teamView === "people" && loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <span className="text-xs text-[var(--text-muted)]">{dict.dashboard.users_loading}</span>
                </div>
            ) : teamView === "people" ? (
                <>
                    <div className="mb-4 flex justify-end">
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                            {dict.users.people_view_label}
                            <DocumentFormSelect
                                value={peopleScope}
                                onChange={(event) => setPeopleScope(event.target.value as PeopleScope)}
                                className="h-10 min-w-52 py-0"
                            >
                                <option value="all">{dict.users.all_people}</option>
                                <option value="internal">{dict.users.internal_team}</option>
                                <option value="external">{dict.users.external_accesses}</option>
                            </DocumentFormSelect>
                        </label>
                    </div>
                    {peopleScope === "external" && (
                        <p className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-[var(--text-muted)]">
                            {dict.users.external_accesses_info}
                        </p>
                    )}
                <TeamListSection
                    team={filteredTeam}
                    currentUser={currentUser}
                    labels={{
                        full_name: dict.users.full_name,
                        email: dict.users.email,
                        role: dict.users.role,
                        status: dict.users.status,
                        actions: dict.users.actions,
                        status_active: dict.users.status_active,
                        status_inactive: dict.users.status_inactive,
                        you: dict.users.you,
                        empty: dict.users.empty,
                        list_title: dict.users.team_list_title,
                        list_subtitle: dict.users.team_list_subtitle,
                        member_one: dict.users.member_one,
                        member_many: dict.users.member_many,
                        action_edit: dict.users.action_edit,
                        action_delete: dict.users.action_delete,
                        ...roleLabels,
                    }}
                    onEdit={handleEditClick}
                    onDelete={(user) => setDeleteState({ target: user, submitting: false })}
                />
                </>
            ) : (
                <CollaborationManagementPanel
                    refreshKey={companyInvitationRefreshKey}
                />
            )}

            <TeamInvitationChooserDialog
                open={invitationChooserOpen}
                onOpenChange={setInvitationChooserOpen}
                onInvitePerson={() => setCreateOpen(true)}
                onInviteCompany={openCompanyInvitation}
                canInviteCompany={currentUser?.role?.name === "admin" && Boolean(currentUser.company_id)}
            />

            <CompanyInvitationDialog
                open={companyInvitationOpen}
                onOpenChange={setCompanyInvitationOpen}
                onSent={() => setCompanyInvitationRefreshKey((current) => current + 1)}
            />

            <UserCreateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                roles={roles}
                defaultRoleId={defaultRoleId}
                onCreated={refreshTeam}
                labels={{
                    new_worker: dict.users.new_worker,
                    new_worker_desc: dict.users.new_worker_desc,
                    worker_invitation_steps: dict.users.worker_invitation_steps,
                    full_name: dict.users.full_name,
                    full_name_placeholder: dict.users.full_name_placeholder,
                    email: dict.users.email,
                    email_placeholder: dict.users.email_placeholder,
                    role: dict.users.role,
                    cancel: dict.clients.form.cancel,
                    submitting: dict.users.submitting,
                    submit_create: dict.users.submit_create,
                    success_create: dict.users.success_create,
                    error_create: dict.users.error_create,
                    ...roleLabels,
                }}
            />

            <UserEditDialog
                open={edit.open}
                onOpenChange={(open) => {
                    if (!open) setEdit({ open: false, user: null });
                    else setEdit((current) => ({ ...current, open: true }));
                }}
                user={edit.user}
                roles={roles}
                onUpdated={refreshTeam}
                labels={{
                    edit_worker: dict.users.edit_worker,
                    full_name: dict.users.full_name,
                    full_name_placeholder: dict.users.full_name_placeholder,
                    role: dict.users.role,
                    cancel: dict.clients.form.cancel,
                    submitting: dict.users.submitting,
                    submit_update: dict.users.submit_update,
                    success_update: dict.users.success_update,
                    error_update: dict.users.error_update,
                    system_access: dict.users?.system_access,
                    active_access_desc: dict.users?.active_access_desc,
                    inactive_access_desc: dict.users?.inactive_access_desc,
                    ...roleLabels,
                }}
            />

            <DeleteConfirmDialog
                open={deleteState.target !== null}
                onOpenChange={(open) => !open && setDeleteState({ target: null, submitting: false })}
                title={dict.users.delete_confirm_title}
                description={dict.users.delete_confirm_description.replace(
                    "{email}",
                    deleteState.target?.email || dict.users.delete_target_fallback,
                )}
                onConfirm={handleDeleteWorker}
                isDeleting={deleteState.submitting}
                confirmText={dict.users.action_delete}
                cancelText={dict.clients.form.cancel}
                confirmIcon={Trash2}
                confirmVariant="danger"
            />
        </div>
    );
}
