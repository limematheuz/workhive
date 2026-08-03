"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    getAuthFormMessages,
    prepareEmailChangeRequest,
} from "@/lib/auth-forms";
import { useDictionary, type Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
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
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {copy.email_change_title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    {copy.email_change_description}
                </p>
            </div>

            {sentTo ? (
                <div className="flex items-start gap-3 border-l-2 border-emerald-500 bg-emerald-500/5 px-4 py-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <label htmlFor="new-profile-email" className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {copy.email_change_new}
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
                            <input
                                id="new-profile-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={newEmail}
                                onChange={(event) => setNewEmail(event.target.value)}
                                placeholder={copy.email_change_placeholder}
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] py-3 pl-10 pr-4 text-sm text-[var(--text-main)] outline-none ui-motion focus:border-accent/70 focus:ring-2 focus:ring-accent/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="email-change-password" className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {copy.email_change_password}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
                            <input
                                id="email-change-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                                placeholder={copy.email_change_password_placeholder}
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] py-3 pl-10 pr-10 text-sm text-[var(--text-main)] outline-none ui-motion focus:border-accent/70 focus:ring-2 focus:ring-accent/10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                aria-label={showPassword ? copy.hide_password : copy.show_password}
                                className="absolute right-3 top-3.5 cursor-pointer border-none bg-transparent p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!sentTo && (
                <div className="flex justify-end border-t border-[var(--border-soft)] pt-4">
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="border-none bg-[var(--text-main)] px-6 text-xs font-semibold text-[var(--text-inverse)] hover:opacity-90"
                    >
                        {submitting ? copy.email_change_sending : copy.email_change_submit}
                    </Button>
                </div>
            )}
        </form>
    );
}
