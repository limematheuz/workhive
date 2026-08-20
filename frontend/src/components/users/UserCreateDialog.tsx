"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import type { Role } from "@/services/role.service";
import { UserService } from "@/services/user.service";

import { getRoleText } from "./user-role-utils";

type UserCreateDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: Role[];
    defaultRoleId: string;
    onCreated: () => void;
    labels: {
        new_worker: string;
        new_worker_desc: string;
        full_name: string;
        full_name_placeholder: string;
        email: string;
        email_placeholder: string;
        role: string;
        cancel: string;
        submitting: string;
        submit_create: string;
        success_create: string;
        error_create: string;
        role_superadmin?: string;
        role_admin?: string;
        role_accountant?: string;
        role_manager?: string;
        role_installer?: string;
        role_viewer?: string;
    };
};

type CreateFormState = {
    fullName: string;
    email: string;
    roleId: string;
    submitting: boolean;
};

const EMPTY_CREATE_FORM: CreateFormState = {
    fullName: "",
    email: "",
    roleId: "",
    submitting: false,
};

export function UserCreateDialog({
    open,
    onOpenChange,
    roles,
    defaultRoleId,
    onCreated,
    labels,
}: UserCreateDialogProps) {
    const [form, setForm] = useState<CreateFormState>(() => ({
        ...EMPTY_CREATE_FORM,
        roleId: defaultRoleId,
    }));

    useEffect(() => {
        if (!open) return;
        startTransition(() => {
            setForm({
                ...EMPTY_CREATE_FORM,
                roleId: defaultRoleId || roles[0]?.id.toString() || "",
            });
        });
    }, [open, defaultRoleId, roles]);

    const roleLabels = {
        role_superadmin: labels.role_superadmin,
        role_admin: labels.role_admin,
        role_accountant: labels.role_accountant,
        role_manager: labels.role_manager,
        role_installer: labels.role_installer,
        role_viewer: labels.role_viewer,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.email || !form.roleId) return;

        try {
            setForm((current) => ({ ...current, submitting: true }));
            await UserService.inviteUser({
                email: form.email,
                full_name: form.fullName || undefined,
                role_id: parseInt(form.roleId, 10),
            });
            toast.success(labels.success_create);
            setForm({
                ...EMPTY_CREATE_FORM,
                roleId: defaultRoleId || roles[0]?.id.toString() || "",
            });
            onOpenChange(false);
            onCreated();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, labels.error_create));
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
                            {labels.new_worker}
                        </DialogTitle>
                        <DialogDescription>{labels.new_worker_desc}</DialogDescription>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cFullName" className="text-[var(--text-main)]">{labels.full_name}</Label>
                            <input
                                id="cFullName"
                                type="text"
                                value={form.fullName}
                                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                                placeholder={labels.full_name_placeholder}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)] rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-color)] transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cEmail" className="text-[var(--text-main)]">{labels.email}</Label>
                            <input
                                id="cEmail"
                                type="email"
                                value={form.email}
                                required
                                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                                placeholder={labels.email_placeholder}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)] rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-color)] transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cRoleId" className="text-[var(--text-main)]">{labels.role}</Label>
                            <select
                                id="cRoleId"
                                aria-label={labels.role}
                                value={form.roleId}
                                required
                                onChange={(e) => setForm((current) => ({ ...current, roleId: e.target.value }))}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm outline-none"
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>{getRoleText(r.name, roleLabels)}</option>
                                ))}
                            </select>
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
                            ) : labels.submit_create}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
