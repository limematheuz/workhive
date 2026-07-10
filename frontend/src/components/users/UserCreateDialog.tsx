"use client";

import { startTransition, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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
        accessLabel: string;
        accessPlaceholder: string;
        role: string;
        cancel: string;
        submitting: string;
        submit_create: string;
        success_create: string;
        error_create: string;
        role_superadmin?: string;
        role_admin?: string;
        role_manager?: string;
        role_installer?: string;
        role_viewer?: string;
    };
};

type CreateFormState = {
    fullName: string;
    email: string;
    secret: string;
    revealSecret: boolean;
    roleId: string;
    submitting: boolean;
};

const EMPTY_CREATE_FORM: CreateFormState = {
    fullName: "",
    email: "",
    secret: "",
    revealSecret: false,
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
        role_manager: labels.role_manager,
        role_installer: labels.role_installer,
        role_viewer: labels.role_viewer,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.email || !form.secret || !form.roleId) return;

        try {
            setForm((current) => ({ ...current, submitting: true }));
            await UserService.createUser({
                email: form.email,
                access_code: form.secret,
                full_name: form.fullName || undefined,
                role_id: parseInt(form.roleId, 10),
                is_active: true,
            });
            toast.success(labels.success_create);
            setForm({
                ...EMPTY_CREATE_FORM,
                roleId: defaultRoleId || roles[0]?.id.toString() || "",
            });
            onOpenChange(false);
            onCreated();
        } catch (error: unknown) {
            console.error("Error registering worker", error);
            toast.error(getErrorMessage(error, labels.error_create));
        } finally {
            setForm((current) => ({ ...current, submitting: false, secret: "" }));
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
                            <Label htmlFor="cSecret" className="text-[var(--text-main)]">{labels.accessLabel}</Label>
                            <div className="relative">
                                <input
                                    id="cSecret"
                                    type={form.revealSecret ? "text" : "password"}
                                    value={form.secret}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    onChange={(e) => setForm((current) => ({ ...current, secret: e.target.value }))}
                                    placeholder={labels.accessPlaceholder}
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)] rounded-md pl-3 pr-10 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-color)] transition-colors"
                                />
                                <button
                                    type="button"
                                    aria-label={form.revealSecret ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    onClick={() => setForm((current) => ({ ...current, revealSecret: !current.revealSecret }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-0.5 flex items-center justify-center"
                                >
                                    {form.revealSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
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

                    <div className="p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer transition-all"
                        >
                            {labels.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.submitting}
                            className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
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
