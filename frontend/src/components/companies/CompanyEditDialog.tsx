"use client";

import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeSwiftBicInput } from "@/lib/banking";

export type CompanyEditFormData = {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    bank_account: string;
    swift_bic: string;
};

type CompanyEditDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formData: CompanyEditFormData;
    setFormData: (data: CompanyEditFormData) => void;
    submitting: boolean;
    onSubmit: (event: React.FormEvent) => void;
    labels: {
        editTitle: string;
        name: string;
        cif: string;
        phone: string;
        email: string;
        address: string;
        iban: string;
        swiftBic: string;
        cancel: string;
        saving: string;
        save: string;
    };
};

export function CompanyEditDialog({
    open,
    onOpenChange,
    formData,
    setFormData,
    submitting,
    onSubmit,
    labels,
}: CompanyEditDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 text-[var(--text-main)] sm:max-w-[500px]">
                <form onSubmit={onSubmit} className="flex min-h-0 max-h-[calc(100vh-1rem)] flex-col">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-accent" />
                            {labels.editTitle}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{labels.name}</Label>
                                <Input
                                    id="name"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="min-w-0 space-y-2">
                                    <Label htmlFor="tax_id">{labels.cif}</Label>
                                    <Input
                                        id="tax_id"
                                        value={formData.tax_id}
                                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                                <div className="min-w-0 space-y-2">
                                    <Label htmlFor="phone">{labels.phone}</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">{labels.email}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">{labels.address}</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_account">{labels.iban}</Label>
                                    <Input
                                        id="bank_account"
                                        value={formData.bank_account}
                                        onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)] font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="swift_bic">{labels.swiftBic}</Label>
                                    <Input
                                        id="swift_bic"
                                        value={formData.swift_bic}
                                        onChange={(e) => setFormData({ ...formData, swift_bic: normalizeSwiftBicInput(e.target.value) })}
                                        placeholder="CAIXESBBXXX"
                                        maxLength={11}
                                        pattern="[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?"
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)] font-mono uppercase"
                                    />
                                </div>
                            </div>

                        </div>
                    </div>

                    <DialogFooter className="dialog-glass-chrome shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {labels.cancel}
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? labels.saving : labels.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
