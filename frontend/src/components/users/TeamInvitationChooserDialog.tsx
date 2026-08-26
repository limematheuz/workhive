"use client";

import { Building2, CheckCircle2, UserPlus } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";

type TeamInvitationChooserDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvitePerson: () => void;
    onInviteCompany: () => void;
    canInviteCompany: boolean;
};

export function TeamInvitationChooserDialog({
    open,
    onOpenChange,
    onInvitePerson,
    onInviteCompany,
    canInviteCompany,
}: TeamInvitationChooserDialogProps) {
    const { dict } = useDictionary();

    const choose = (action: () => void) => {
        onOpenChange(false);
        action();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-[720px]">
                <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 sm:px-6">
                    <DialogTitle>{dict.users.invite_choose_title}</DialogTitle>
                    <DialogDescription>{dict.users.invite_choose_description}</DialogDescription>
                </DialogHeader>

                <div className={`grid gap-3 p-5 sm:p-6 ${canInviteCompany ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                    <button
                        type="button"
                        onClick={() => choose(onInvitePerson)}
                        className="billing-block group flex cursor-pointer flex-col items-start rounded-2xl p-5 text-left ui-motion hover:border-accent/35 hover:bg-accent/5"
                    >
                        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <UserPlus className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="text-base font-semibold text-[var(--text-main)]">
                            {dict.users.invite_person_title}
                        </span>
                        <span className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                            {dict.users.invite_person_description}
                        </span>
                        <ul className="mt-4 space-y-2 text-sm leading-5 text-[var(--text-muted)]">
                            {dict.users.invite_person_bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    </button>

                    {canInviteCompany && (
                        <button
                            type="button"
                            onClick={() => choose(onInviteCompany)}
                            className="billing-block group flex cursor-pointer flex-col items-start rounded-2xl p-5 text-left ui-motion hover:border-accent/35 hover:bg-accent/5"
                        >
                            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                <Building2 className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="text-base font-semibold text-[var(--text-main)]">
                                {dict.users.invite_company_title}
                            </span>
                            <span className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                                {dict.users.invite_company_description}
                            </span>
                            <ul className="mt-4 space-y-2 text-sm leading-5 text-[var(--text-muted)]">
                                {dict.users.invite_company_bullets.map((bullet) => (
                                    <li key={bullet} className="flex gap-2">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
