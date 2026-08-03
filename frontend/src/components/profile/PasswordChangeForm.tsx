"use client";

import React, { useState } from "react";
import { User } from "@/types/user";
import { UserService } from "@/services/user.service";
import { toast } from "@/lib/toast";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";

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
        <form onSubmit={handleUpdatePassword} className="space-y-6 w-full relative z-10">
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Cambio de Contraseña de Seguridad
                </h3>

                <div className="space-y-1.5">
                    <label htmlFor="password-old" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Contraseña Actual
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            id="password-old"
                            type={showOldPassword ? "text" : "password"}
                            required
                            value={profileOldPassword}
                            onChange={(e) => setProfileOldPassword(e.target.value)}
                            placeholder="Introduce tu clave actual"
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] ui-motion shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                            aria-label={showOldPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            className="absolute right-3 top-3.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-0.5"
                        >
                            {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="password-new" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            Nueva Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                id="password-new"
                                type={showPassword ? "text" : "password"}
                                required
                                value={profilePassword}
                                onChange={(e) => setProfilePassword(e.target.value)}
                                placeholder="Mín. 6 caracteres"
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] ui-motion shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                className="absolute right-3 top-3.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-0.5"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="password-confirm" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            Confirmar Nueva Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                id="password-confirm"
                                type={showConfirmPassword ? "text" : "password"}
                                required
                                value={profileConfirmPassword}
                                onChange={(e) => setProfileConfirmPassword(e.target.value)}
                                placeholder="Repite la clave"
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] ui-motion shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                className="absolute right-3 top-3.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none bg-transparent border-none cursor-pointer p-0.5"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                        setProfilePassword("");
                        setProfileOldPassword("");
                        setProfileConfirmPassword("");
                        onCancel();
                    }}
                    className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border-none cursor-pointer"
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={updating}
                    className="bg-[var(--text-main)] text-[var(--text-inverse)] hover:opacity-90 text-xs font-semibold px-6 border-none cursor-pointer"
                >
                    {updating ? "Guardando..." : "Actualizar Contraseña"}
                </Button>
            </div>
        </form>
    );
}
