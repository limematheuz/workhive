"use client";

import { Building2, UserRound } from "lucide-react";

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

export type CompanyProvisionData = {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    owner_full_name: string;
    owner_email: string;
    owner_access_code: string;
    subscription_plan: string;
    trial_days: string;
};

type CompanyProvisionDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    provisionData: CompanyProvisionData;
    setProvisionData: (data: CompanyProvisionData) => void;
    submitting: boolean;
    onSubmit: (event: React.FormEvent) => void;
};

function ProvisionField({
    label,
    value,
    onChange,
    type = "text",
    wide = false,
    autoComplete,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    wide?: boolean;
    autoComplete?: string;
}) {
    return (
        <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
            <Label>{label}</Label>
            <Input
                required
                type={type}
                value={value}
                autoComplete={autoComplete}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 rounded-xl border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-main)]"
            />
        </div>
    );
}

export function CompanyProvisionDialog({
    open,
    onOpenChange,
    provisionData,
    setProvisionData,
    submitting,
    onSubmit,
}: CompanyProvisionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-hidden p-0 text-[var(--text-main)] sm:max-w-[640px]">
                <form onSubmit={onSubmit} className="flex max-h-[90vh] flex-col">
                    <DialogHeader className="border-b border-[var(--border-soft)] p-6">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-accent" />
                            Activar nueva empresa
                        </DialogTitle>
                        <p className="text-sm text-[var(--text-muted)]">
                            Crea el espacio de trabajo y su primer propietario/admin.
                        </p>
                    </DialogHeader>
                    <div className="flex-1 space-y-6 overflow-y-auto p-6">
                        <section className="space-y-4">
                            <h3 className="text-xs font-black uppercase text-accent">Empresa</h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <ProvisionField label="Nombre comercial" value={provisionData.name} onChange={(value) => setProvisionData({ ...provisionData, name: value })} wide />
                                <ProvisionField label="NIF / CIF" value={provisionData.tax_id} onChange={(value) => setProvisionData({ ...provisionData, tax_id: value })} />
                                <ProvisionField label="Teléfono" value={provisionData.phone} onChange={(value) => setProvisionData({ ...provisionData, phone: value })} />
                                <ProvisionField label="Email de empresa" type="email" value={provisionData.email} onChange={(value) => setProvisionData({ ...provisionData, email: value })} wide />
                                <ProvisionField label="Dirección fiscal" value={provisionData.address} onChange={(value) => setProvisionData({ ...provisionData, address: value })} wide />
                            </div>
                        </section>
                        <section className="space-y-4 border-t border-[var(--border-soft)] pt-5">
                            <h3 className="text-xs font-black uppercase text-accent">Acceso</h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Licencia</Label>
                                    <select
                                        aria-label="Licencia"
                                        value={provisionData.subscription_plan}
                                        onChange={(event) => setProvisionData({ ...provisionData, subscription_plan: event.target.value })}
                                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-[var(--text-main)]"
                                    >
                                        <option value="trial">Prueba</option>
                                        <option value="pro">Pro</option>
                                    </select>
                                </div>
                                {provisionData.subscription_plan === "trial" && (
                                    <ProvisionField
                                        label="Días de prueba"
                                        type="number"
                                        value={provisionData.trial_days}
                                        onChange={(value) => setProvisionData({ ...provisionData, trial_days: value })}
                                    />
                                )}
                            </div>
                        </section>
                        <section className="space-y-4 border-t border-[var(--border-soft)] pt-5">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-accent">
                                <UserRound className="h-4 w-4" />
                                Propietario de la cuenta
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <ProvisionField label="Nombre completo" value={provisionData.owner_full_name} onChange={(value) => setProvisionData({ ...provisionData, owner_full_name: value })} wide />
                                <ProvisionField label="Email de acceso" type="email" value={provisionData.owner_email} onChange={(value) => setProvisionData({ ...provisionData, owner_email: value })} />
                                <ProvisionField
                                    label="Contraseña temporal"
                                    type="password"
                                    value={provisionData.owner_access_code}
                                    autoComplete="new-password"
                                    onChange={(value) => setProvisionData({ ...provisionData, owner_access_code: value })}
                                />
                            </div>
                            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                                El propietario entrará como administrador de su empresa y completará el onboarding operativo.
                            </p>
                        </section>
                    </div>
                    <DialogFooter className="border-t border-[var(--border-soft)] bg-[var(--bg-card)] p-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting} className="rounded-xl bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]">
                            {submitting ? "Activando..." : "Activar empresa"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
