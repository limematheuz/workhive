"use client";

import { useMemo, useState } from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import type { Role } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import { InvitationLinkDialog } from "@/components/invitations/InvitationLinkDialog";
import { SelectField } from "@/components/ui/select-field";

type OrganizationInvitePersonDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: Role[];
    onSent: () => void | Promise<void>;
};

const ACCESS_OPTIONS = ["admin", "manager", "viewer"] as const;

export function OrganizationInvitePersonDialog({
    open,
    onOpenChange,
    roles,
    onSent,
}: OrganizationInvitePersonDialogProps) {
    const { dict } = useDictionary();
    const copy = dict.organization.invite_dialog;
    const invitationRoles = useMemo(
        () => ACCESS_OPTIONS.flatMap((roleName) => {
            const role = roles.find((item) => item.name === roleName);
            return role ? [{ roleName, roleId: role.id }] : [];
        }),
        [roles],
    );
    const defaultRoleId = String(
        invitationRoles.find((role) => role.roleName === "viewer")?.roleId
        ?? invitationRoles[0]?.roleId
        ?? "",
    );
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [roleId, setRoleId] = useState(defaultRoleId);
    const [saving, setSaving] = useState(false);
    const [delivery, setDelivery] = useState<"email" | "link">("email");
    const [createdLink, setCreatedLink] = useState<{ email: string; invitationUrl: string; verificationCode: string; expiresAt: string } | null>(null);

    const selectedRole = invitationRoles.find((role) => String(role.roleId) === roleId);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim() || !roleId) return;

        try {
            setSaving(true);
            const result = await UserService.inviteUser({
                email: email.trim(),
                full_name: fullName.trim() || undefined,
                role_id: Number(roleId),
                delivery,
            });
            if (result.delivery === "link" && result.invitation_url && result.verification_code) {
                setCreatedLink({ email: result.email, invitationUrl: result.invitation_url, verificationCode: result.verification_code, expiresAt: result.expires_at });
                return;
            }
            await onSent();
            toast.success(copy.sent);
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.send_error));
        } finally {
            setSaving(false);
        }
    };

    if (createdLink) return <InvitationLinkDialog {...createdLink} onClose={() => {
        setCreatedLink(null);
        onOpenChange(false);
        void onSent();
    }} />;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="max-h-[90dvh] max-w-xl overflow-y-auto">
                <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
                    <DialogHeader>
                        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <UserPlus className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <DialogTitle>{copy.title}</DialogTitle>
                        <DialogDescription>{selectedRole?.roleName === "admin" ? copy.admin_invitation_description : copy.description}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="organization-invite-full-name">{copy.name}</Label>
                            <Input
                                id="organization-invite-full-name"
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                                autoComplete="name"
                                placeholder={copy.name_placeholder}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="organization-invite-email">{copy.email}</Label>
                            <Input
                                id="organization-invite-email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                                placeholder={copy.email_placeholder}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organization-invite-access-class">{copy.initial_type}</Label>
                        <Select value={roleId} onValueChange={setRoleId}>
                            <SelectTrigger id="organization-invite-access-class">
                                <SelectValue placeholder={copy.select_type} />
                            </SelectTrigger>
                            <SelectContent>
                                {invitationRoles.map((role) => (
                                    <SelectItem key={role.roleId} value={String(role.roleId)}>
                                        {role.roleName === "admin" ? dict.organization.access.admin : role.roleName === "manager" ? dict.organization.access.responsible : dict.organization.access.worker}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedRole && (
                            <p className="text-xs leading-5 text-[var(--text-muted)]">{selectedRole.roleName === "admin" ? copy.admin_description : selectedRole.roleName === "manager" ? copy.responsible_description : copy.worker_description}</p>
                        )}
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-accent/15 bg-accent/5 p-3 text-xs leading-5 text-[var(--text-muted)]">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <p>{selectedRole?.roleName === "admin" ? copy.admin_notice : copy.notice}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="organization-invite-delivery">Entrega de la invitación</Label>
                        <SelectField id="organization-invite-delivery" aria-label="Entrega de la invitación" value={delivery} onValueChange={value => setDelivery(value === "link" ? "link" : "email")} options={[
                            { value: "email", label: "Enviar por correo" },
                            { value: "link", label: "Crear enlace y código para compartir" },
                        ]} />
                        <p className="text-xs leading-5 text-muted-foreground">{delivery === "link" ? "El enlace y el código se mostrarán una sola vez. No requiere correo configurado." : "La persona acepta su invitación. Si ya tiene cuenta, conserva sus accesos y su contraseña."}</p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || !roleId}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {delivery === "link" ? "Crear enlace de invitación" : dict.organization.actions.send_invitation}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
