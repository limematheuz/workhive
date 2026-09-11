"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { User } from "@/types/user";
import { UserService } from "@/services/user.service";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DocumentFormInput } from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { ProfileFormSection } from "@/components/profile/ProfileFormSection";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";

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
        <form onSubmit={handleUpdateDetails} className="relative z-10 w-full space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <ProfileFormSection title={dict.profile.form.identity_title}>
                    <div className="flex w-full min-w-0 flex-col gap-3">
                        <DocumentFormField id="profile-full-name" label={dict.profile.form.full_name}>
                            <DocumentFormInput
                                id="profile-full-name"
                                type="text"
                                required
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder={dict.profile.form.full_name_placeholder}
                            />
                        </DocumentFormField>

                        <div className="flex min-w-0 w-full flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="profile-email">{dict.profile.email}</Label>
                                <span className="shrink-0 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-2xs font-semibold lowercase text-amber-600 dark:bg-amber-500/5 dark:text-amber-500">
                                    {dict.profile.form.email_change_security}
                                </span>
                            </div>
                            <DocumentFormInput
                                id="profile-email"
                                type="email"
                                disabled
                                value={user.email || ""}
                                aria-label={dict.profile.email}
                                className="cursor-not-allowed opacity-70"
                            />
                        </div>
                    </div>
                </ProfileFormSection>

                <ProfileFormSection
                    title={dict.profile.form.photo_title}
                    headerExtra={<ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <UserAvatar
                            name={user.full_name}
                            email={user.email}
                            photoUrl={profilePhotoUrl}
                            className="h-16 w-16 shrink-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-sm"
                            textClassName="text-sm"
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                            <label className="group flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card-solid)]/40 px-3 py-3 text-center transition-colors hover:border-accent hover:bg-accent/5">
                                <Upload className="mb-1.5 h-4 w-4 text-accent" />
                                <span className="text-xs font-semibold text-[var(--text-main)]">
                                    {profilePhotoUrl.startsWith("data:")
                                        ? dict.profile.form.photo_uploaded
                                        : dict.profile.form.photo_select}
                                </span>
                                <span className="mt-0.5 text-2xs font-medium text-[var(--text-muted)]">
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
                                    className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--btn-cancel-text)]"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    {dict.profile.form.photo_remove}
                                </button>
                            )}
                        </div>
                    </div>
                </ProfileFormSection>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-[var(--border-soft)] pt-3">
                <Button
                    type="button"
                    variant="cancel"
                    onClick={() => {
                        setProfileName(user.full_name || "");
                        setProfilePhotoUrl(user.photo_url || "");
                        onCancel();
                    }}
                >
                    {dict.locations.form.cancel || "Cancel"}
                </Button>
                <Button
                    type="submit"
                    disabled={updating}
                    className={PAGE_ACTION_BUTTON_PRIMARY}
                >
                    {updating ? (dict.companies.saving || "Saving...") : (dict.locations.form.save || "Save")}
                </Button>
            </div>
        </form>
    );
}
