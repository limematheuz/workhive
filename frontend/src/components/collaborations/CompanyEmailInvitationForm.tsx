"use client";

import { FormEvent } from "react";
import { Building2, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentControlClassName } from "@/components/billing/DocumentFormControls";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { useDictionary } from "@/lib/dictionary-context";

type CompanyEmailInvitationFormProps = {
    email: string;
    roleType: "service_provider" | "property_manager";
    sending: boolean;
    loading: boolean;
    onEmailChange: (email: string) => void;
    onRoleTypeChange: (roleType: "service_provider" | "property_manager") => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    showHeader?: boolean;
};

export function CompanyEmailInvitationForm({
    email,
    roleType,
    sending,
    loading,
    onEmailChange,
    onRoleTypeChange,
    onSubmit,
    showHeader = true,
}: CompanyEmailInvitationFormProps) {
    const { dict } = useDictionary();

    return (
        <section className="billing-block rounded-2xl p-4 sm:p-5">
            {showHeader && (
                <header className="mb-4 flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-main)]">{dict.collaborations.email_invite_title}</h3>
                        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                            {dict.collaborations.email_invite_description}
                        </p>
                    </div>
                </header>
            )}

            <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)_auto] md:items-end">
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="company-invitation-email" className="text-xs text-[var(--text-muted)]">{dict.collaborations.business_email}</Label>
                    <Input
                        id="company-invitation-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        placeholder={dict.collaborations.business_email_placeholder}
                        onChange={(event) => onEmailChange(event.target.value)}
                        className={documentControlClassName}
                    />
                </div>
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="company-invitation-role" className="text-xs text-[var(--text-muted)]">{dict.collaborations.relationship}</Label>
                    <Select
                        value={roleType}
                        onValueChange={(value) => onRoleTypeChange(value as typeof roleType)}
                    >
                        <SelectTrigger id="company-invitation-role" className={documentControlClassName}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="service_provider">{dict.collaborations.service_provider}</SelectItem><SelectItem value="property_manager">{dict.collaborations.property_manager}</SelectItem></SelectContent>
                    </Select>
                </div>
                <Button type="submit" disabled={sending || loading || !email.trim()} className={PAGE_ACTION_BUTTON_PRIMARY}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {dict.collaborations.send_invitation}
                </Button>
            </form>
        </section>
    );
}
