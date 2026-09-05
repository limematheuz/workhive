"use client";

import { type FormEvent, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiResponseError } from "@/lib/api";
import { useDictionary } from "@/lib/dictionary-context";
import { sponsoredPartnerInvitationService } from "@/services/sponsored-partner-invitation.service";

type SponsoredPropertyManagerInvitationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSent: () => void;
    onBack?: () => void;
};

export function SponsoredPropertyManagerInvitationDialog({
    open,
    onOpenChange,
    onSent,
    onBack,
}: SponsoredPropertyManagerInvitationDialogProps) {
    const { dict } = useDictionary();
    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (sending || !companyName.trim() || !email.trim()) return;
        try {
            setSending(true);
            await sponsoredPartnerInvitationService.invite(email.trim(), companyName.trim());
            toast.success(dict.collaborations.sponsored_invite_sent);
            setCompanyName("");
            setEmail("");
            onOpenChange(false);
            onSent();
        } catch (error) {
            toast.error(
                error instanceof ApiResponseError && error.status === 409
                    ? dict.collaborations.sponsored_invite_pending_exists
                    : error instanceof Error
                        ? error.message
                        : dict.collaborations.sponsored_invite_error,
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                    <DialogTitle>{dict.collaborations.sponsored_invite_title}</DialogTitle>
                    <DialogDescription>{dict.collaborations.sponsored_invite_description}</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(event) => void submit(event)}>
                    <div className="space-y-1.5">
                        <Label htmlFor="sponsored-partner-company">{dict.collaborations.sponsored_company_name}</Label>
                        <Input
                            id="sponsored-partner-company"
                            required
                            autoComplete="organization"
                            value={companyName}
                            onChange={(event) => setCompanyName(event.target.value)}
                            placeholder={dict.collaborations.sponsored_company_placeholder}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="sponsored-partner-email">{dict.collaborations.business_email}</Label>
                        <Input
                            id="sponsored-partner-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={dict.collaborations.business_email_placeholder}
                        />
                    </div>
                    <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm leading-6 text-[var(--text-muted)]">
                        {dict.collaborations.sponsored_invite_notice}
                    </div>
                    <div className="flex justify-between gap-2">
                        {onBack ? <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />Volver</Button> : <span />}
                        <div className="flex gap-2">
                        <DialogClose asChild><Button type="button" variant="outline">{dict.collaborations.cancel}</Button></DialogClose>
                        <Button type="submit" disabled={sending || !companyName.trim() || !email.trim()}>
                            {sending ? <Loader2 className="animate-spin" /> : <Building2 />}
                            {sending ? dict.collaborations.sponsored_invite_sending : dict.collaborations.sponsored_invite_action}
                        </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
