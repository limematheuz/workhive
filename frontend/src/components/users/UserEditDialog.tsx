"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DocumentFormSelect,
    documentControlClassName,
} from "@/components/billing/DocumentFormControls";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { Role } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import type { User } from "@/types/user";

import { getRoleText } from "./user-role-utils";

type UserEditDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    roles: Role[];
    showRoleSelector?: boolean;
    onUpdated: () => void;
    labels: {
        edit_worker: string;
        full_name: string;
        full_name_placeholder: string;
        role: string;
        cancel: string;
        submitting: string;
        submit_update: string;
        success_update: string;
        error_update: string;
        system_access?: string;
        active_access_desc?: string;
        inactive_access_desc?: string;
        role_superadmin?: string;
        role_admin?: string;
        role_external_portal?: string;
        role_manager?: string;
        role_installer?: string;
        role_viewer?: string;
    };
};

type EditFormState = {
    fullName: string;
    roleId: string;
    isActive: boolean;
    submitting: boolean;
};

export function UserEditDialog({
    open,
    onOpenChange,
    user,
    roles,
    showRoleSelector = true,
    onUpdated,
    labels,
}: UserEditDialogProps) {
    const [form, setForm] = useState<EditFormState>({
        fullName: "",
        roleId: "",
        isActive: true,
        submitting: false,
    });

    useEffect(() => {
        if (!open || !user) return;
        startTransition(() => {
            setForm({
                fullName: user.full_name || "",
                roleId: user.role_id.toString(),
                isActive: user.is_active ?? true,
                submitting: false,
            });
        });
    }, [open, user]);

    const roleLabels = {
        role_superadmin: labels.role_superadmin,
        role_admin: labels.role_admin,
        role_external_portal: labels.role_external_portal,
        role_manager: labels.role_manager,
        role_installer: labels.role_installer,
        role_viewer: labels.role_viewer,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !form.roleId) return;

        try {
            setForm((current) => ({ ...current, submitting: true }));
            await UserService.updateUser(user.id, {
                full_name: form.fullName || undefined,
                role_id: parseInt(form.roleId, 10),
                is_active: form.isActive,
            });
            toast.success(labels.success_update);
            onOpenChange(false);
            onUpdated();
        } catch (error: unknown) {
            console.error("Error updating worker", error);
            toast.error(getErrorMessage(error, labels.error_update));
        } finally {
            setForm((current) => ({ ...current, submitting: false }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {labels.edit_worker}
                        </DialogTitle>
                        <DialogDescription>{user?.email}</DialogDescription>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        {showRoleSelector && <div className="space-y-2">
                            <Label htmlFor="eFullName" className="text-[var(--text-main)]">{labels.full_name}</Label>
                            <Input
                                id="eFullName"
                                type="text"
                                value={form.fullName}
                                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                                placeholder={labels.full_name_placeholder}
                            />
                        </div>}
                        <div className="space-y-2">
                            <Label htmlFor="eRoleId" className="text-[var(--text-main)]">{labels.role}</Label>
                            <DocumentFormSelect
                                id="eRoleId"
                                aria-label={labels.role}
                                value={form.roleId}
                                required
                                onChange={(e) => setForm((current) => ({ ...current, roleId: e.target.value }))}
                                className={documentControlClassName}
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>{getRoleText(r.name, roleLabels)}</option>
                                ))}
                            </DocumentFormSelect>
                        </div>
                        <div className="flex items-center justify-between bg-[var(--bg-primary)]/40 p-4 rounded-xl border border-[var(--border-soft)]">
                            <div className="flex flex-col gap-0.5">
                                <Label className="text-xs font-semibold text-[var(--text-main)]">{labels.system_access || "System access"}</Label>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {form.isActive ? (labels.active_access_desc || "The user can log in") : (labels.inactive_access_desc || "The user's access is suspended")}
                                </span>
                            </div>
                            <Button
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
                                aria-label={labels.system_access || "System access"}
                                variant="ghost"
                                size="icon"
                                className="text-accent hover:bg-accent/10 hover:text-accent"
                            >
                                {form.isActive ? (
                                    <ToggleRight className="w-10 h-10 stroke-[1.5px]" />
                                ) : (
                                    <ToggleLeft className="w-10 h-10 text-[var(--text-muted)] stroke-[1.5px]" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                        >
                            {labels.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.submitting}
                            className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion"
                        >
                            {form.submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" />{labels.submitting}</>
                            ) : labels.submit_update}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
