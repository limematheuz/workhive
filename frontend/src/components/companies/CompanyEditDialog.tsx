"use client";

import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CompanyEditFormData = {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    bank_account: string;
    subscription_plan: string;
    subscription_status: string;
    trial_ends_at: string;
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
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden text-[var(--text-main)]">
                <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-accent" />
                            {labels.editTitle}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tax_id">{labels.cif}</Label>
                                    <Input
                                        id="tax_id"
                                        value={formData.tax_id}
                                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                                <div className="space-y-2">
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

                            <div className="space-y-2">
                                <Label htmlFor="bank_account">{labels.iban}</Label>
                                <Input
                                    id="bank_account"
                                    value={formData.bank_account}
                                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                                    className="bg-[var(--bg-primary)] border-[var(--border-color)]"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 p-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="subscription_plan">Licencia</Label>
                                    <select
                                        id="subscription_plan"
                                        aria-label="Licencia"
                                        value={formData.subscription_plan}
                                        onChange={(e) => {
                                            const plan = e.target.value;
                                            setFormData({
                                                ...formData,
                                                subscription_plan: plan,
                                                subscription_status: plan === "trial" ? "trialing" : plan === "none" ? "inactive" : "active",
                                                trial_ends_at: plan === "trial" ? formData.trial_ends_at : "",
                                            });
                                        }}
                                        className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"
                                    >
                                        <option value="trial">Prueba</option>
                                        <option value="pro">Pro</option>
                                        <option value="none">Sin acceso</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="trial_ends_at">Fin de prueba</Label>
                                    <Input
                                        id="trial_ends_at"
                                        type="date"
                                        disabled={formData.subscription_plan !== "trial"}
                                        value={formData.trial_ends_at}
                                        onChange={(e) => setFormData({ ...formData, trial_ends_at: e.target.value })}
                                        className="bg-[var(--bg-primary)] border-[var(--border-color)] disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer transition-all"
                        >
                            {labels.cancel}
                        </Button>
                        <Button type="submit" disabled={submitting} className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                            {submitting ? labels.saving : labels.save}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
