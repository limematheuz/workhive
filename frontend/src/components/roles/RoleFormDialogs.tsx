"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type RoleFormData = {
    name: string;
    description: string;
};

type RoleFormCopy = {
    role_name: string;
    description: string;
    name_placeholder: string;
    desc_placeholder: string;
    create_title: string;
    edit_title: string;
    cancel: string;
    creating: string;
    create_btn: string;
    saving: string;
    save: string;
};

type RoleFormDialogsProps = {
    copy: RoleFormCopy;
    formData: RoleFormData;
    setFormData: (next: RoleFormData) => void;
    submitting: boolean;
    isCreateOpen: boolean;
    setIsCreateOpen: (open: boolean) => void;
    isEditOpen: boolean;
    onEditOpenChange: (open: boolean) => void;
    onCreateSubmit: (event: React.FormEvent) => void;
    onEditSubmit: (event: React.FormEvent) => void;
    onCancelEdit: () => void;
};

export function RoleFormDialogs({
    copy,
    formData,
    setFormData,
    submitting,
    isCreateOpen,
    setIsCreateOpen,
    isEditOpen,
    onEditOpenChange,
    onCreateSubmit,
    onEditSubmit,
    onCancelEdit,
}: RoleFormDialogsProps) {
    return (
        <>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col p-0 overflow-hidden text-[var(--text-main)]">
                    <form onSubmit={onCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5 text-accent" />
                                {copy.create_title}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="create-name">{copy.role_name}</Label>
                                    <Input
                                        id="create-name"
                                        required
                                        placeholder={copy.name_placeholder}
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase() })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="create-desc">{copy.description}</Label>
                                    <Input
                                        id="create-desc"
                                        placeholder={copy.desc_placeholder}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateOpen(false)}
                                className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                            >
                                {copy.cancel}
                            </Button>
                            <Button type="submit" disabled={submitting} className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion">
                                {submitting ? copy.creating : copy.create_btn}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={onEditOpenChange}>
                <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col p-0 overflow-hidden text-[var(--text-main)]">
                    <form onSubmit={onEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                            <DialogTitle className="flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-accent" />
                                {copy.edit_title}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">{copy.role_name}</Label>
                                    <Input
                                        id="edit-name"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase() })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="edit-desc">{copy.description}</Label>
                                    <Input
                                        id="edit-desc"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancelEdit}
                                className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                            >
                                {copy.cancel}
                            </Button>
                            <Button type="submit" disabled={submitting} className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion">
                                {submitting ? copy.saving : copy.save}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
