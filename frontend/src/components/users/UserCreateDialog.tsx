"use client";

import { startTransition, useEffect, useState } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import {
    DocumentFormSelect,
    documentControlClassName,
} from "@/components/billing/DocumentFormControls";
import { Button } from "@/components/ui/button";
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

import { getRoleText } from "./user-role-utils";

type UserCreateDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: Role[];
    defaultRoleId: string;
    showRoleSelector?: boolean;
    onCreated: () => void;
    labels: {
        new_worker: string;
        new_worker_desc: string;
        worker_invitation_steps: string[];
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
        role_external_portal?: string;
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
    showRoleSelector = true,
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
        role_external_portal: labels.role_external_portal,
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
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-lg">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-6 py-5">
                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <UserPlus className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <DialogTitle className="text-xl font-bold">{labels.new_worker}</DialogTitle>
                        <DialogDescription className="leading-6">{labels.new_worker_desc}</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        <ul className="space-y-2 rounded-xl border border-accent/15 bg-accent/5 p-3 text-xs leading-5 text-[var(--text-muted)]">
                            {labels.worker_invitation_steps.map((step) => (
                                <li key={step} className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="cFullName" className="text-[var(--text-main)]">{labels.full_name}</Label>
                                <Input
                                id="cFullName"
                                type="text"
                                value={form.fullName}
                                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                                placeholder={labels.full_name_placeholder}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cEmail" className="text-[var(--text-main)]">{labels.email}</Label>
                                <Input
                                id="cEmail"
                                type="email"
                                value={form.email}
                                required
                                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                                placeholder={labels.email_placeholder}
                                />
                            </div>
                        </div>
                        {showRoleSelector && <div className="space-y-2">
                            <Label htmlFor="cRoleId" className="text-[var(--text-main)]">{labels.role}</Label>
                            <DocumentFormSelect
                                id="cRoleId"
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
                        </div>}
                    </div>

                    <div className="dialog-glass-chrome flex shrink-0 gap-3 border-t border-[var(--border-soft)] px-6 py-4">
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
