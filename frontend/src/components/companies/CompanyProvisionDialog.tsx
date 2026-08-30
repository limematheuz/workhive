"use client";

import { Building2, Info, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type ProvisionPlanCode = "trial" | "basic" | "medium" | "top" | "mega" | "custom";

export type CompanyProvisionData = {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    owner_full_name: string;
    owner_email: string;
    owner_access_code: string;
    subscription_plan: ProvisionPlanCode;
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
    id,
    label,
    value,
    onChange,
    type = "text",
    wide = false,
    autoComplete,
    min,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    wide?: boolean;
    autoComplete?: string;
    min?: number;
}) {
    return (
        <div className={`min-w-0 space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                required
                type={type}
                min={min}
                value={value}
                autoComplete={autoComplete}
                onChange={(event) => onChange(event.target.value)}
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
    const isTrial = provisionData.subscription_plan === "trial";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 text-[var(--text-main)] sm:max-w-[640px]">
                <form onSubmit={onSubmit} className="flex min-h-0 max-h-[calc(100vh-1rem)] flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                        <DialogTitle className="flex items-center gap-2 text-left">
                            <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
                            Activar empresa
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Crea el espacio de trabajo y su primer administrador.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                        <section className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wide text-accent">Empresa</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <ProvisionField id="company-name" label="Nombre comercial" value={provisionData.name} onChange={(value) => setProvisionData({ ...provisionData, name: value })} wide />
                                <ProvisionField id="company-tax-id" label="CIF / NIF" value={provisionData.tax_id} onChange={(value) => setProvisionData({ ...provisionData, tax_id: value })} />
                                <ProvisionField id="company-phone" label="Teléfono" value={provisionData.phone} onChange={(value) => setProvisionData({ ...provisionData, phone: value })} />
                                <ProvisionField id="company-email" label="Email fiscal de la empresa" type="email" value={provisionData.email} onChange={(value) => setProvisionData({ ...provisionData, email: value })} wide />
                                <ProvisionField id="company-address" label="Dirección fiscal" value={provisionData.address} onChange={(value) => setProvisionData({ ...provisionData, address: value })} wide />
                            </div>
                        </section>

                        <section className="space-y-3 border-t border-[var(--border-soft)] pt-5">
                            <h3 className="text-xs font-black uppercase tracking-wide text-accent">Plan y acceso</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="min-w-0 space-y-1.5">
                                    <Label htmlFor="company-plan">Plan</Label>
                                    <Select
                                        value={provisionData.subscription_plan}
                                        onValueChange={(value) => setProvisionData({
                                            ...provisionData,
                                            subscription_plan: value as ProvisionPlanCode,
                                        })}
                                    >
                                        <SelectTrigger id="company-plan"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trial">Prueba (Top)</SelectItem>
                                            <SelectItem value="basic">Basic</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="top">Top</SelectItem>
                                            <SelectItem value="mega">Enterprise</SelectItem>
                                            <SelectItem value="custom">Personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {isTrial && (
                                    <ProvisionField
                                        id="company-trial-days"
                                        label="Días de prueba"
                                        type="number"
                                        min={1}
                                        value={provisionData.trial_days}
                                        onChange={(value) => setProvisionData({ ...provisionData, trial_days: value })}
                                    />
                                )}
                            </div>
                            <p className="flex gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                {isTrial
                                    ? "La prueba siempre incluye Top y termina automáticamente en la fecha elegida."
                                    : provisionData.subscription_plan === "custom"
                                        ? "Después de activar la empresa, configura las excepciones de capacidad y módulos en Plan y acceso."
                                        : "El plan define la capacidad y los módulos disponibles. Los permisos personales se gestionan por separado."}
                            </p>
                        </section>

                        <section className="space-y-3 border-t border-[var(--border-soft)] pt-5">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-accent">
                                <UserRound className="h-4 w-4" aria-hidden="true" />
                                Administrador de la empresa
                            </h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <ProvisionField id="owner-full-name" label="Nombre completo" value={provisionData.owner_full_name} onChange={(value) => setProvisionData({ ...provisionData, owner_full_name: value })} wide />
                                <ProvisionField id="owner-email" label="Email del administrador" type="email" value={provisionData.owner_email} onChange={(value) => setProvisionData({ ...provisionData, owner_email: value })} />
                                <ProvisionField id="owner-access-code" label="Contraseña temporal" type="password" value={provisionData.owner_access_code} autoComplete="new-password" onChange={(value) => setProvisionData({ ...provisionData, owner_access_code: value })} />
                            </div>
                            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                                Esto crea la primera cuenta administradora. El envío de una invitación verificada por email es un flujo independiente.
                            </p>
                        </section>
                    </div>

                    <DialogFooter className="dialog-glass-chrome shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Activando…" : "Activar empresa"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
