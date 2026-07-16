"use client";

import React, { useState } from "react";
import { User } from "@/types/user";
import { UserService } from "@/services/user.service";
import { toast } from "@/lib/toast";
import { User as UserIcon, Mail, Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";

interface ProfileDetailsFormProps {
    user: User;
    dict: Dictionary;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

// Client-side image compression to 128x128px JPEG 70% as Base64 string
const compressImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                // Crop and scale to center cover (128x128)
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);

                const base64 = canvas.toDataURL("image/jpeg", 0.7);
                resolve(base64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export function ProfileDetailsForm({ user, dict, onCancel, onSuccess }: ProfileDetailsFormProps) {
    const [profileName, setProfileName] = useState(user.full_name || "");
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(user.photo_url || "");
    const [updating, setUpdating] = useState(false);

    const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const maxInputSize = 10 * 1024 * 1024;
        if (file.size > maxInputSize) {
            toast.error(dict.profile.form.toast_size_error || "The image must be less than 10MB");
            return;
        }

        try {
            toast.loading(dict.profile.form.toast_compressing, { id: "photo-processing" });
            const base64 = await compressImageToBase64(file);
            setProfilePhotoUrl(base64);
            toast.success(dict.profile.form.toast_compress_success, { id: "photo-processing" });
        } catch (error) {
            console.error("Error compressing image:", error);
            toast.error(dict.profile.form.toast_compress_error, { id: "photo-processing" });
        }
    };

    const handleUpdateDetails = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setUpdating(true);
            const payload = {
                full_name: profileName,
                photo_url: profilePhotoUrl.trim() !== "" ? profilePhotoUrl : null,
            };

            await UserService.updateUser(user.id, payload);
            toast.success(dict.profile.form.toast_update_success);
            await onSuccess();
        } catch (err: unknown) {
            console.error("Error updating details:", err);
            toast.error(getErrorMessage(err, dict.profile.form.toast_update_error));
        } finally {
            setUpdating(false);
        }
    };

    return (
        <form onSubmit={handleUpdateDetails} className="space-y-6 w-full relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile.form.identity_title}
                    </h3>

                    <div className="space-y-1.5">
                        <label htmlFor="profile-full-name" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            {dict.profile.form.full_name}
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                id="profile-full-name"
                                type="text"
                                required
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder={dict.profile.form.full_name_placeholder}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="profile-email" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex justify-between">
                            <span>{dict.profile.email}</span>
                            <span className="text-2xs text-amber-600 dark:text-amber-500 font-semibold lowercase bg-amber-500/10 dark:bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/20">
                                {dict.profile.form.email_change_security}
                            </span>
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--text-muted)]/50" />
                            <input
                                id="profile-email"
                                type="email"
                                disabled
                                value={user.email || ""}
                                aria-label={dict.profile.email}
                                className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]/60 rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-muted)] outline-none cursor-not-allowed shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                {/* Profile photo */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        {dict.profile.form.photo_title}
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                        <UserAvatar
                            name={user.full_name}
                            email={user.email}
                            photoUrl={profilePhotoUrl}
                            className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-soft)] flex-shrink-0 text-sm"
                            textClassName="text-sm"
                        />

                        <div className="flex-1 min-w-0 space-y-3">
                            <label className="group flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 px-4 py-5 text-center transition-colors hover:border-accent hover:bg-accent/5">
                                <Upload className="mb-2 h-5 w-5 text-accent" />
                                <span className="text-sm font-semibold text-[var(--text-main)]">
                                    {profilePhotoUrl.startsWith("data:") ? dict.profile.form.photo_uploaded : dict.profile.form.photo_select}
                                </span>
                                <span className="mt-1 text-2xs font-medium text-[var(--text-muted)]">
                                    {dict.profile.form.photo_hint}
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={handleProfilePhotoChange}
                                    className="sr-only"
                                />
                            </label>

                            {profilePhotoUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfilePhotoUrl("");
                                    }}
                                    className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--btn-cancel-text)] transition-colors border-none cursor-pointer bg-transparent"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    {dict.profile.form.photo_remove}
                                </button>
                            )}
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
                        setProfileName(user.full_name || "");
                        setProfilePhotoUrl(user.photo_url || "");
                        onCancel();
                    }}
                    className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border-none cursor-pointer"
                >
                    {dict.locations.form.cancel || "Cancel"}
                </Button>
                <Button
                    type="submit"
                    disabled={updating}
                    className="bg-[var(--text-main)] text-[var(--text-inverse)] hover:opacity-90 text-xs font-semibold px-6 border-none cursor-pointer"
                >
                    {updating ? (dict.companies.saving || "Saving...") : (dict.locations.form.save || "Save")}
                </Button>
            </div>
        </form>
    );
}
