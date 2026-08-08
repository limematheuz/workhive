"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";
import { RoleService, Role } from "@/services/role.service";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/errors";
import { RoleFormDialogs } from "@/components/roles/RoleFormDialogs";
import { RolesListSection } from "@/components/roles/RolesListSection";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { isPlatformSuperadmin } from "@/domain/access/roles";

export default function RolesAdminPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const selectedRoleRef = useRef<Role | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });

    const fetchRoles = useCallback(async () => {
        try {
            setLoading(true);
            const data = await RoleService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error(error);
            toast.error(dict.roles.toast_error_load);
        } finally {
            setLoading(false);
        }
    }, [dict.roles.toast_error_load]);

    useEffect(() => {
        if (userLoading || !isPlatformSuperadmin(user)) return;
        startTransition(() => {
            void fetchRoles();
        });
    }, [fetchRoles, user, userLoading]);

    if (!userLoading && !isPlatformSuperadmin(user)) {
        redirect("/dashboard");
    }

    const handleCreateClick = () => {
        setFormData({ name: "", description: "" });
        setIsCreateOpen(true);
    };

    const handleEditClick = (role: Role) => {
        selectedRoleRef.current = role;
        setFormData({
            name: role.name || "",
            description: role.description || "",
        });
        setIsEditOpen(true);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const created = await RoleService.createRole(formData);
            toast.success(dict.roles.toast_success_create);
            setRoles((prev) => [...prev, created]);
            setIsCreateOpen(false);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.roles.toast_error_create));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedRole = selectedRoleRef.current;
        if (!selectedRole) return;

        try {
            setSubmitting(true);
            const updated = await RoleService.updateRole(selectedRole.id, formData);
            toast.success(dict.roles.toast_success_update);
            setRoles((prev) =>
                prev.map((r) => (r.id === selectedRole.id ? updated : r))
            );
            setIsEditOpen(false);
            selectedRoleRef.current = null;
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.roles.toast_error_update));
        } finally {
            setSubmitting(false);
        }
    };

    if (userLoading || loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!isPlatformSuperadmin(user)) {
        return null;
    }

    return (
        <div className="mx-auto max-w-7xl space-y-5 px-[3%] py-6 text-[var(--text-main)] md:p-8">
            <PageHeader
                icon={ShieldCheck}
                title={dict.roles.title}
                subtitle={dict.roles.subtitle}
                className="mb-0"
                actions={(
                    <button
                        type="button"
                        onClick={handleCreateClick}
                        className={`${PAGE_ACTION_BUTTON_PRIMARY} cursor-pointer`}
                    >
                        <Plus className="h-4 w-4" />
                        {dict.roles.new_role}
                    </button>
                )}
            />

            <RolesListSection
                roles={roles}
                labels={{
                    listTitle: dict.roles.list_title,
                    listSubtitle: dict.roles.list_subtitle,
                    roleName: dict.roles.role_name,
                    description: dict.roles.description,
                    status: dict.roles.status,
                    actions: dict.roles.actions,
                    active: dict.roles.active,
                    inactive: dict.roles.inactive,
                    edit: dict.roles.edit,
                    empty: dict.roles.empty,
                    countOne: dict.roles.count_one,
                    countMany: dict.roles.count_many,
                }}
                onEdit={handleEditClick}
            />

            <RoleFormDialogs
                copy={{
                    role_name: dict.roles.role_name,
                    description: dict.roles.description,
                    name_placeholder: dict.roles.name_placeholder,
                    desc_placeholder: dict.roles.desc_placeholder,
                    create_title: dict.roles.create_title,
                    edit_title: dict.roles.edit_title,
                    cancel: dict.roles.cancel,
                    creating: dict.roles.creating,
                    create_btn: dict.roles.create_btn,
                    saving: dict.roles.saving,
                    save: dict.roles.save,
                }}
                formData={formData}
                setFormData={setFormData}
                submitting={submitting}
                isCreateOpen={isCreateOpen}
                setIsCreateOpen={setIsCreateOpen}
                isEditOpen={isEditOpen}
                onEditOpenChange={(nextOpen) => {
                    setIsEditOpen(nextOpen);
                    if (!nextOpen) selectedRoleRef.current = null;
                }}
                onCreateSubmit={handleCreateSubmit}
                onEditSubmit={handleEditSubmit}
                onCancelEdit={() => {
                    setIsEditOpen(false);
                    selectedRoleRef.current = null;
                }}
            />
        </div>
    );
}
