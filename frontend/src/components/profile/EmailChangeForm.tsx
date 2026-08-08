"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentFormInput } from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { ProfileFormSection } from "@/components/profile/ProfileFormSection";
import {
    getAuthFormMessages,
    prepareEmailChangeRequest,
} from "@/lib/auth-forms";
import { useDictionary, type Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { authService } from "@/services/auth.service";
import type { User } from "@/types/user";


interface EmailChangeFormProps {
    user: User;
    dict: Dictionary;
}


export function EmailChangeForm({ user, dict }: EmailChangeFormProps) {
    const copy = dict.profile.form;
    const { locale } = useDictionary();
    const [newEmail, setNewEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const prepared = prepareEmailChangeRequest(
            newEmail,
            user.email,
            currentPassword,
            getAuthFormMessages(locale),
        );
        if (!prepared.request) {
            const message = prepared.error || copy.email_change_error;
            toast.error(
                message === "The new email must be different from the current email."
                    ? copy.email_change_same
                    : message,
            );
            return;
        }

        setSubmitting(true);
        try {
            await authService.requestEmailChange(
                prepared.request.newEmail,
                prepared.request.currentPassword,
            );
            setSentTo(prepared.request.newEmail);
            setCurrentPassword("");
            toast.success(copy.email_change_sent);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, copy.email_change_error));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <ProfileFormSection
                title={copy.email_change_title}
                description={copy.email_change_description}
            >
                {sentTo ? (
                    <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/10 px-3.5 py-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div>
                            <p className="font-semibold text-[var(--text-main)]">
                                {copy.email_change_sent}
                            </p>
                            <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                                {sentTo}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex w-full min-w-0 flex-col gap-3">
                        <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                            <DocumentFormField id="new-profile-email" label={copy.email_change_new}>
                                <DocumentFormInput
                                    id="new-profile-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={newEmail}
                                    onChange={(event) => setNewEmail(event.target.value)}
                                    placeholder={copy.email_change_placeholder}
                                />
                            </DocumentFormField>

                            <DocumentFormField id="email-change-password" label={copy.email_change_password}>
                                <div className="relative">
                                    <DocumentFormInput
                                        id="email-change-password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        value={currentPassword}
                                        onChange={(event) => setCurrentPassword(event.target.value)}
                                        placeholder={copy.email_change_password_placeholder}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        aria-label={showPassword ? copy.hide_password : copy.show_password}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </DocumentFormField>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={submitting}
                                className={PAGE_ACTION_BUTTON_PRIMARY}
                            >
                                {submitting ? copy.email_change_sending : copy.email_change_submit}
                            </Button>
                        </div>
                    </div>
                )}
            </ProfileFormSection>
        </form>
    );
}
