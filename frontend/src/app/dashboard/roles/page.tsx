"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";
import { RoleService, Role } from "@/services/role.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/errors";
import { RoleFormDialogs } from "@/components/roles/RoleFormDialogs";

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
        if (userLoading || !user || user.role?.name !== "superadmin") return;
        startTransition(() => {
            void fetchRoles();
        });
    }, [fetchRoles, user, userLoading]);

    if (!userLoading && (!user || user.role?.name !== "superadmin")) {
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

    if (!user || user.role?.name !== "superadmin") {
        return null; // The useEffect hook handles the redirect.
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 text-[var(--text-main)] px-[3%] py-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-accent" />
                        {dict.roles.title}
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
                        {dict.roles.subtitle}
                    </p>
                </div>
                <button type="button"
                    onClick={handleCreateClick}
                    className="bg-black text-white hover:bg-neutral-800 font-semibold rounded-xl px-4 py-2.5 text-xs flex items-center justify-center gap-2 transition-all shadow-sm border-none cursor-pointer self-start sm:self-center"
                >
                    <Plus className="h-4 w-4" />
                    {dict.roles.new_role}
                </button>
            </div>

            {roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-soft)]">
                    <ShieldCheck className="h-12 w-12 text-[var(--text-muted)] mb-4" />
                    <p className="text-[var(--text-muted)] text-lg">{dict.roles.empty}</p>
                </div>
            ) : (
                <>
                    {/* ── Mobile & Tablet: Cards ── */}
                    <div className="lg:hidden space-y-3">
                        {roles.map((role) => (
                            <div
                                key={role.id}
                                className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-3 shadow-sm"
                            >
                                {/* Header: Name + Status + Edit button */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 uppercase tracking-wide">
                                                <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                                                {role.name}
                                            </span>
                                            <Badge
                                                className={role.is_active
                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase"
                                                    : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-soft)] text-[9px] font-bold uppercase"}
                                            >
                                                {role.is_active ? dict.roles.active : dict.roles.inactive}
                                            </Badge>
                                        </div>
                                    </div>
                                    <button type="button"
                                        onClick={() => handleEditClick(role)}
                                        aria-label={`${dict.roles.edit} ${role.name}`}
                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-accent transition-colors border-none bg-transparent cursor-pointer"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Description */}
                                <div className="pt-2 border-t border-[var(--border-soft)]/50 text-xs text-[var(--text-muted)] leading-relaxed">
                                    {role.description || "—"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop: Table ── */}
                    <div className="hidden lg:block bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{dict.roles.role_name}</TableHead>
                                    <TableHead>{dict.roles.description}</TableHead>
                                    <TableHead>{dict.roles.status}</TableHead>
                                    <TableHead className="text-right">{dict.roles.actions}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-semibold flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-accent" />
                                            {role.name}
                                        </TableCell>
                                        <TableCell className="text-[var(--text-muted)]">{role.description || "—"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                className={role.is_active
                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase"
                                                    : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-soft)] text-[9px] font-bold uppercase"}
                                            >
                                                {role.is_active ? dict.roles.active : dict.roles.inactive}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditClick(role)}
                                                className="text-[var(--text-muted)] hover:text-accent hover:bg-[var(--bg-primary)] gap-1.5"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                {dict.roles.edit}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}

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
