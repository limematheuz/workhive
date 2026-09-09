"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { User } from "@/types/user";
import { UserService } from "@/services/user.service";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { DocumentFormInput } from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { ProfileFormSection } from "@/components/profile/ProfileFormSection";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";

interface PasswordChangeFormProps {
    user: User;
    dict: Dictionary;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

export function PasswordChangeForm({ user, dict, onCancel, onSuccess }: PasswordChangeFormProps) {
    const [profileOldPassword, setProfileOldPassword] = useState("");
    const [profilePassword, setProfilePassword] = useState("");
    const [profileConfirmPassword, setProfileConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [updating, setUpdating] = useState(false);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (profileOldPassword.trim() === "") {
            toast.error("Debes ingresar tu contraseña actual para establecer una nueva.");
            return;
        }
        if (profilePassword !== profileConfirmPassword) {
            toast.error("La nueva contraseña y la confirmación no coinciden.");
            return;
        }
        if (profilePassword.length < 6) {
            toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            setUpdating(true);
            await UserService.updateUser(user.id, {
                full_name: user.full_name, // keep full name
                password: profilePassword,
                old_password: profileOldPassword,
            });

            toast.success(dict.users?.success_update || "Contraseña actualizada con éxito");
            setProfilePassword("");
            setProfileOldPassword("");
            setProfileConfirmPassword("");
            await onSuccess();
        } catch (err: unknown) {
            console.error("Error updating password:", err);
            toast.error(getErrorMessage(
                err,
                dict.users?.error_update || "Error al actualizar la contraseña."
            ));
        } finally {
            setUpdating(false);
        }
    };

    return (
        <form onSubmit={handleUpdatePassword} className="relative z-10 w-full">
            <ProfileFormSection
                title="Cambio de Contraseña de Seguridad"
                description="Introduce tu clave actual y define una nueva de al menos 6 caracteres."
            >
                <div className="flex w-full min-w-0 flex-col gap-3">
                    <DocumentFormField id="password-old" label="Contraseña Actual">
                        <div className="relative">
                            <DocumentFormInput
                                id="password-old"
                                type={showOldPassword ? "text" : "password"}
                                required
                                value={profileOldPassword}
                                onChange={(e) => setProfileOldPassword(e.target.value)}
                                placeholder="Introduce tu clave actual"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowOldPassword(!showOldPassword)}
                                aria-label={showOldPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] focus:outline-none"
                            >
                                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </DocumentFormField>

                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                        <DocumentFormField id="password-new" label="Nueva Contraseña">
                            <div className="relative">
                                <DocumentFormInput
                                    id="password-new"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={profilePassword}
                                    onChange={(e) => setProfilePassword(e.target.value)}
                                    placeholder="Mín. 6 caracteres"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </DocumentFormField>

                        <DocumentFormField id="password-confirm" label="Confirmar Nueva Contraseña">
                            <div className="relative">
                                <DocumentFormInput
                                    id="password-confirm"
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    value={profileConfirmPassword}
                                    onChange={(e) => setProfileConfirmPassword(e.target.value)}
                                    placeholder="Repite la clave"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] focus:outline-none"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </DocumentFormField>
                    </div>

                    <div className="flex justify-end gap-2.5 border-t border-[var(--border-soft)] pt-3">
                        <Button
                            type="button"
                            variant="cancel"
                            onClick={() => {
                                setProfilePassword("");
                                setProfileOldPassword("");
                                setProfileConfirmPassword("");
                                onCancel();
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={updating}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            {updating ? "Guardando..." : "Actualizar Contraseña"}
                        </Button>
                    </div>
                </div>
            </ProfileFormSection>
        </form>
    );
}
