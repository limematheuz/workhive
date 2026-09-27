"use client";

import { CalendarClock, Check, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyPlanAccess, Entitlement, PlanCode } from "@/services/company-plan-access.service";
import type { Company } from "@/services/company.service";
import { CommercialChangeConfirmationDialog } from "./CommercialChangeConfirmationDialog";
import { CommercialTermsFields } from "./CommercialTermsFields";
import { EntitlementConfigurationEditor } from "./EntitlementConfigurationEditor";
import { auditLabel, dateForInput, useCompanyPlanAccessDialog } from "./useCompanyPlanAccessDialog";

type Props = {
    company: Company | null;
    onOpenChange: (open: boolean) => void;
    onUpdated: (access: CompanyPlanAccess) => void;
};

type Controller = ReturnType<typeof useCompanyPlanAccessDialog>;

export function CompanyPlanAccessDialog({ company, onOpenChange, onUpdated }: Props) {
    const controller = useCompanyPlanAccessDialog({ company, onOpenChange, onUpdated });
    const { access, close, companyName, confirmation, dismissConfirmation, loading, open } = controller;

    return (
        <>
            <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
                <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                    <div className="flex min-h-0 flex-1 flex-col">
                        <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                            <DialogTitle className="flex items-center gap-2 text-left"><ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />Plan y acceso</DialogTitle>
                            <DialogDescription className="text-left">{companyName}. Solo los administradores de plataforma de WorkHive pueden cambiar esta configuración.</DialogDescription>
                        </DialogHeader>
                        {loading || !access ? <LoadingState /> : <DialogBody controller={controller} />}
                    </div>
                </DialogContent>
            </Dialog>
            <CommercialChangeConfirmationDialog
                open={confirmation === "plan"}
                onOpenChange={(nextOpen) => !nextOpen && dismissConfirmation()}
                title="Confirmar cambio de plan"
                description="Revisa el impacto antes de actualizar las condiciones comerciales de esta empresa."
                reason={controller.planReason}
                changes={controller.planChanges}
                confirmLabel="Confirmar cambio de plan"
                onConfirm={() => void controller.savePlan()}
                isSubmitting={controller.submitting}
                note={access?.overrides.length ? "Las excepciones personalizadas activas se conservan y se han incluido en este resumen." : undefined}
            />
            <CommercialChangeConfirmationDialog
                open={confirmation === "custom"}
                onOpenChange={(nextOpen) => !nextOpen && dismissConfirmation()}
                title="Confirmar configuración personalizada"
                description="Esta operación modifica las funciones o capacidades específicas de la empresa."
                reason={controller.customReason}
                changes={controller.customizationChanges}
                confirmLabel="Guardar configuración"
                onConfirm={() => void controller.saveCustomization()}
                isSubmitting={controller.submitting}
                note="Las capacidades se validarán frente al uso actual antes de guardar."
            />
        </>
    );
}

function LoadingState() {
    return <div className="flex min-h-52 flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" aria-label="Cargando plan y acceso" /></div>;
}

function DialogBody({ controller }: { controller: Controller }) {
    const { access, activeTab, setActiveTab } = controller;
    if (!access) return null;
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-5 pt-3 sm:px-6">
                <PremiumTabs
                    tabs={[
                        { id: "plan", label: "Plan" },
                        { id: "custom", label: "Personalizado" },
                        { id: "history", label: "Historial" },
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    mobileLabel="Sección de plan y acceso"
                />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                {activeTab === "plan" && <PlanTab controller={controller} />}
                {activeTab === "custom" && <CustomTab controller={controller} />}
                {activeTab === "history" && <AuditList audit={access.audit} subscription={access.subscription} />}
            </div>
        </div>
    );
}

function PlanTab({ controller }: { controller: Controller }) {
    const { access, close, commercialTerms, planChanges, planCode, planFeatures, planLimits, planReason, planStatus, requestPlanSave, selectablePlans, setActiveTab, setCommercialTerms, setPlanCode, setPlanReason, setPlanStatus, setTrialEndsAt, submitting, trialEndsAt } = controller;
    if (!access) return null;
    return (
        <form className="space-y-5" onSubmit={requestPlanSave}>
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm leading-relaxed text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-main)]">Paso 1.</span> Elige el plan contratado. Selecciona <span className="font-semibold text-[var(--text-main)]">Prueba</span> solo para un acceso temporal; entonces indicaremos su fecha de finalización.</div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2"><Label htmlFor="company-plan">Plan</Label><Select value={planCode} onValueChange={(value) => setPlanCode(value as PlanCode)}><SelectTrigger id="company-plan"><SelectValue /></SelectTrigger><SelectContent>{selectablePlans.map((plan) => <SelectItem key={plan.code} value={plan.code}>{plan.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 space-y-2"><Label htmlFor="company-plan-status">Estado de acceso</Label><Select value={planStatus} onValueChange={(value) => setPlanStatus(value as "active" | "trialing")}><SelectTrigger id="company-plan-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="trialing">Prueba</SelectItem></SelectContent></Select></div>
            </div>
            {planStatus === "trialing" && <div className="max-w-sm space-y-2"><Label htmlFor="company-trial-end">Fin de la prueba</Label><DatePicker id="company-trial-end" required value={trialEndsAt} onValueChange={setTrialEndsAt} /></div>}
            {planStatus === "active" && <CommercialTermsFields idPrefix="company-commercial-terms" value={commercialTerms} onChange={setCommercialTerms} />}
            <div className="space-y-2"><Label htmlFor="company-plan-reason">Motivo del cambio</Label><Textarea id="company-plan-reason" required minLength={3} value={planReason} onChange={(event) => setPlanReason(event.target.value)} placeholder="Por ejemplo: suscripción anual firmada" /></div>
            <PlanSummary features={planFeatures} limits={planLimits} usage={access.usage} />
            <Button type="button" variant="outline" onClick={() => setActiveTab("custom")}><SlidersHorizontal className="h-4 w-4" />Personalizar funciones y capacidad</Button>
            <DialogFooter className="border-t border-[var(--border-soft)] pt-4"><Button type="button" variant="cancel" onClick={close}>Cancelar</Button><Button type="submit" disabled={submitting || planChanges.length === 0}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Guardar plan</Button></DialogFooter>
        </form>
    );
}

function CustomTab({ controller }: { controller: Controller }) {
    const { access, baseValues, close, commercialTerms, customEndsAt, customReason, customValues, customizationChanges, hasCustomizationChanges, requestCustomizationSave, resetCustomizationToPlan, setCommercialTerms, setCustomEndsAt, setCustomReason, setCustomValue, submitting } = controller;
    if (!access) return null;
    if (access.subscription.status !== "active") return <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 p-4"><h3 className="text-sm font-semibold text-[var(--text-main)]">Configuración personalizada no disponible</h3><p className="text-sm leading-relaxed text-[var(--text-muted)]">Las ampliaciones solo se aplican a una suscripción activa con condiciones comerciales registradas. Activa primero el plan desde la pestaña Plan.</p></section>;
    return (
        <form className="space-y-5" onSubmit={requestCustomizationSave}>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 text-xs leading-relaxed text-[var(--text-muted)] sm:flex-row sm:items-start sm:justify-between"><p><span className="font-semibold text-[var(--text-main)]">Configuración a medida.</span> Parte del plan contratado y selecciona las funciones y capacidades exactas de esta empresa. No es una compra automática: cada diferencia y sus condiciones económicas quedan registradas como una excepción comercial.</p><Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!hasCustomizationChanges} onClick={resetCustomizationToPlan}>Restablecer al plan</Button></div>
            <CommercialTermsFields idPrefix="company-custom-commercial-terms" value={commercialTerms} onChange={setCommercialTerms} />
            <EntitlementConfigurationEditor entitlements={access.base_entitlements} values={customValues} baseValues={baseValues} onChange={setCustomValue} idPrefix="company-customization" />
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="custom-end">Fecha de finalización (opcional)</Label><DatePicker id="custom-end" value={customEndsAt} onValueChange={setCustomEndsAt} /></div><div className="space-y-2"><Label htmlFor="custom-reason">Motivo comercial</Label><Input id="custom-reason" required minLength={3} value={customReason} onChange={(event) => setCustomReason(event.target.value)} placeholder="Ampliación contratada" /></div></div>
            <DialogFooter className="border-t border-[var(--border-soft)] pt-4"><Button type="button" variant="cancel" onClick={close}>Cancelar</Button><Button type="submit" disabled={submitting || customizationChanges.length === 0}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}Guardar configuración</Button></DialogFooter>
            <OverrideList overrides={access.overrides} />
        </form>
    );
}

function PlanSummary({ features, limits, usage }: { features: Entitlement[]; limits: Entitlement[]; usage: CompanyPlanAccess["usage"] }) {
    const usageByLabel: Record<string, number> = { Administradores: usage.administrators, Responsables: usage.managers, Trabajadores: usage.workers, Departamentos: usage.departments, Equipos: usage.teams };
    return <div className="grid gap-4 lg:grid-cols-2"><section className="min-w-0 rounded-xl border border-[var(--border-soft)] p-3"><h3 className="text-sm font-semibold text-[var(--text-main)]">Funciones incluidas</h3><div className="mt-3 flex flex-wrap gap-1.5">{features.map((item) => <Badge key={item.code} variant="outline" className="border-accent/30 bg-accent/10 text-accent">{item.label}</Badge>)}</div></section><section className="min-w-0 rounded-xl border border-[var(--border-soft)] p-3"><h3 className="text-sm font-semibold text-[var(--text-main)]">Capacidad</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Uso actual frente al límite del plan.</p><dl className="mt-2 space-y-1.5 text-xs">{limits.map((item) => <div className="flex items-center justify-between gap-3" key={item.code}><dt className="min-w-0 truncate text-[var(--text-muted)]">{item.label}</dt><dd className="shrink-0 font-semibold text-[var(--text-main)]">{usageByLabel[item.label] ?? "—"} / {item.value}</dd></div>)}</dl></section></div>;
}

function OverrideList({ overrides }: { overrides: CompanyPlanAccess["overrides"] }) {
    return <section className="space-y-2"><h3 className="text-sm font-semibold text-[var(--text-main)]">Accesos personalizados activos</h3>{overrides.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No hay reglas de acceso personalizado activas.</p> : overrides.map((override) => <article key={override.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-[var(--border-soft)] p-3"><div className="min-w-0"><p className="font-medium text-[var(--text-main)]">{override.label}: {String(override.value)}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{override.reason}</p></div>{override.ends_at && <Badge variant="outline" className="shrink-0"><CalendarClock className="h-3 w-3" />Hasta {dateForInput(override.ends_at)}</Badge>}</article>)}</section>;
}

function AuditList({ audit, subscription }: { audit: CompanyPlanAccess["audit"]; subscription: CompanyPlanAccess["subscription"] }) {
    const terms = subscription.commercial_terms;
    return <section className="space-y-2"><div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 p-3"><p className="text-sm font-semibold text-[var(--text-main)]">Configuración actual</p><p className="mt-1 text-sm text-[var(--text-muted)]">{subscription.plan_label}{subscription.plan_version ? ` · versión ${subscription.plan_version}` : ""} · {subscription.status === "trialing" ? "Prueba" : "Activo"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{terms ? `Contrato: ${(terms.amount_cents / 100).toFixed(2)} ${terms.currency} · ${terms.billing_interval === "annual" ? "anual" : "mensual"} · efectivo desde ${dateForInput(terms.effective_at)}` : "Contrato: condiciones económicas aún no registradas"}</p></div>{audit.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Todavía no hay cambios manuales registrados. Este panel muestra sólo operaciones reales: aparecerán aquí al cambiar el plan o al guardar una configuración personalizada, con su motivo.</p> : audit.map((entry) => <article key={entry.id} className="rounded-xl border border-[var(--border-soft)] p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-[var(--text-main)]">{auditLabel(entry.action)}</p><time className="shrink-0 text-xs text-[var(--text-muted)]">{dateForInput(entry.created_at)}</time></div>{entry.reason && <p className="mt-1 text-sm text-[var(--text-muted)]">{entry.reason}</p>}</article>)}</section>;
}
