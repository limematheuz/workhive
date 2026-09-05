"use client";

import { Building2, PanelTopOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";

type CollaboratorAddDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChooseExistingCompany: () => void;
    onChooseSponsoredPropertyManager: () => void;
};

export function CollaboratorAddDialog({
    open,
    onOpenChange,
    onChooseExistingCompany,
    onChooseSponsoredPropertyManager,
}: CollaboratorAddDialogProps) {
    const { dict } = useDictionary();

    const choose = (action: () => void) => {
        onOpenChange(false);
        window.setTimeout(action, 0);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{dict.collaborations.add_collaborator_title}</DialogTitle>
                    <DialogDescription>{dict.collaborations.add_collaborator_description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl px-4 py-4 text-left"
                        onClick={() => choose(onChooseExistingCompany)}
                    >
                        <Building2 className="mr-3 mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--text-main)]">{dict.collaborations.connect_existing_company}</span>
                            <span className="mt-1 block text-xs font-normal leading-5 text-[var(--text-muted)]">{dict.collaborations.connect_existing_company_description}</span>
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl px-4 py-4 text-left"
                        onClick={() => choose(onChooseSponsoredPropertyManager)}
                    >
                        <PanelTopOpen className="mr-3 mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--text-main)]">{dict.collaborations.invite_property_manager_portal}</span>
                            <span className="mt-1 block text-xs font-normal leading-5 text-[var(--text-muted)]">{dict.collaborations.invite_property_manager_portal_description}</span>
                        </span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
