"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { CompanyEmailInvitationForm } from "@/components/collaborations/CompanyEmailInvitationForm";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { ApiResponseError } from "@/lib/api";
import { CollaborationService } from "@/services/collaboration.service";
import { Button } from "@/components/ui/button";

type CompanyInvitationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSent: () => void;
    onBack?: () => void;
};

export function CompanyInvitationDialog({
    open,
    onOpenChange,
    onSent,
    onBack,
}: CompanyInvitationDialogProps) {
    const { dict } = useDictionary();
    const [email, setEmail] = useState("");
    const [roleType, setRoleType] = useState<"service_provider" | "property_manager">("service_provider");
    const [sending, setSending] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim() || sending) return;
        try {
            setSending(true);
            await CollaborationService.inviteCompanyByEmail(email.trim(), roleType);
            toast.success(dict.collaborations.invite_sent);
            setEmail("");
            onOpenChange(false);
            onSent();
        } catch (error) {
            const message = error instanceof ApiResponseError && error.status === 409
                ? dict.collaborations.invite_pending_exists
                : error instanceof Error
                    ? error.message
                    : dict.collaborations.invite_error;
            toast.error(message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                    <DialogTitle>{dict.collaborations.email_invite_title}</DialogTitle>
                    <DialogDescription>{dict.collaborations.email_invite_description}</DialogDescription>
                </DialogHeader>
                <CompanyEmailInvitationForm
                    email={email}
                    roleType={roleType}
                    sending={sending}
                    loading={false}
                    onEmailChange={setEmail}
                    onRoleTypeChange={setRoleType}
                    onSubmit={(event) => void handleSubmit(event)}
                    showHeader={false}
                />
                {onBack && <div className="flex justify-start"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />Volver</Button></div>}
            </DialogContent>
        </Dialog>
    );
}
