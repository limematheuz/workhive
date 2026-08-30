"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { CalendarClock, Check, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import {
    CompanyPlanAccessService,
    type CompanyPlanAccess,
    type Entitlement,
    type PlanCatalogueItem,
    type PlanCode,
} from "@/services/company-plan-access.service";
import type { Company } from "@/services/company.service";
import {
    EntitlementConfigurationEditor,
    type EntitlementValues,
} from "./EntitlementConfigurationEditor";
import {
    CommercialChangeConfirmationDialog,
    entitlementChanges,
    type CommercialChange,
} from "./CommercialChangeConfirmationDialog";

type CompanyPlanAccessDialogProps = {
    company: Company | null;
    onOpenChange: (open: boolean) => void;
    onUpdated: (access: CompanyPlanAccess) => void;
};

type Tab = "plan" | "custom" | "history";

const PLAN_ORDER: PlanCode[] = ["basic", "medium", "top", "mega", "custom"];

type PlanAccessDialogState = {
    catalogue: PlanCatalogueItem[];
    access: CompanyPlanAccess | null;
    activeTab: Tab;
    loading: boolean;
    submitting: boolean;
    planCode: PlanCode;
    planStatus: "active" | "trialing";
    trialEndsAt: string;
    planReason: string;
    customValues: EntitlementValues;
    customEndsAt: string;
    customReason: string;
};

type PlanAccessDialogAction =
    | { type: "load" }
    | { type: "loaded"; catalogue: PlanCatalogueItem[]; access: CompanyPlanAccess }
    | { type: "load-failed" }
    | { type: "tab"; value: Tab }
    | { type: "submitting"; value: boolean }
    | { type: "plan-code"; value: PlanCode }
    | { type: "plan-status"; value: "active" | "trialing" }
    | { type: "trial-ends-at"; value: string }
    | { type: "plan-reason"; value: string }
    | { type: "custom-value"; code: string; value: boolean | number }
    | { type: "custom-ends-at"; value: string }
    | { type: "custom-reason"; value: string }
    | { type: "plan-updated"; access: CompanyPlanAccess }
    | { type: "override-updated"; access: CompanyPlanAccess };

const INITIAL_STATE: PlanAccessDialogState = {
    catalogue: [],
    access: null,
    activeTab: "plan",
    loading: false,
    submitting: false,
    planCode: "top",
    planStatus: "active",
    trialEndsAt: "",
    planReason: "",
    customValues: {},
    customEndsAt: "",
    customReason: "",
};

function dateForInput(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : "";
}

function trialEndDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
}

function toIsoEndOfDay(date: string): string | null {
    return date ? `${date}T23:59:59Z` : null;
}

function valuesFromEntitlements(entitlements: Entitlement[]): EntitlementValues {
    return Object.fromEntries(entitlements.map((item) => [item.code, item.value]));
}

function sharedCustomizationEndDate(overrides: CompanyPlanAccess["overrides"]): string {
    const endDates = [...new Set(overrides.map((override) => dateForInput(override.ends_at)))];
    return endDates.length === 1 ? endDates[0] : "";
}

function accessStatusLabel(status: "active" | "trialing"): string {
    return status === "trialing" ? "Prueba" : "Activo";
}

function reducer(
    state: PlanAccessDialogState,
    action: PlanAccessDialogAction,
): PlanAccessDialogState {
    switch (action.type) {
        case "load":
            return { ...state, loading: true, access: null, activeTab: "plan" };
        case "loaded":
            return {
                ...state,
                loading: false,
                catalogue: action.catalogue,
                access: action.access,
                planCode: action.access.subscription.plan_code,
                planStatus: action.access.subscription.status === "trialing" ? "trialing" : "active",
                trialEndsAt: dateForInput(action.access.subscription.trial_ends_at),
                customValues: Object.fromEntries(
                    action.access.entitlements.map((item) => [item.code, item.value]),
                ),
                customEndsAt: sharedCustomizationEndDate(action.access.overrides),
            };
        case "load-failed": return { ...state, loading: false };
        case "tab": return { ...state, activeTab: action.value };
        case "submitting": return { ...state, submitting: action.value };
        case "plan-code": return { ...state, planCode: action.value };
        case "plan-status": return { ...state, planStatus: action.value };
        case "trial-ends-at": return { ...state, trialEndsAt: action.value };
        case "plan-reason": return { ...state, planReason: action.value };
        case "custom-value": return {
            ...state,
            customValues: { ...state.customValues, [action.code]: action.value },
        };
        case "custom-ends-at": return { ...state, customEndsAt: action.value };
        case "custom-reason": return { ...state, customReason: action.value };
        case "plan-updated": return {
            ...state,
            access: action.access,
            planReason: "",
            customValues: Object.fromEntries(
                action.access.entitlements.map((item) => [item.code, item.value]),
            ),
        };
        case "override-updated": return {
            ...state,
            access: action.access,
            customValues: Object.fromEntries(
                action.access.entitlements.map((item) => [item.code, item.value]),
            ),
            customReason: "",
            customEndsAt: sharedCustomizationEndDate(action.access.overrides),
        };
    }
}

function auditLabel(action: string): string {
    const labels: Record<string, string> = {
        "subscription.manually_changed": "Plan actualizado",
        "entitlement.override_set": "Acceso personalizado actualizado",
        "entitlement.customization_replaced": "Configuración personalizada actualizada",
        "subscription.synchronized": "Plan sincronizado",
    };
    return labels[action] || "Plan y acceso actualizados";
}

export function CompanyPlanAccessDialog({
    company,
    onOpenChange,
    onUpdated,
}: CompanyPlanAccessDialogProps) {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const [confirmation, setConfirmation] = useState<"plan" | "custom" | null>(null);
    const {
        access,
        activeTab,
        catalogue,
        loading,
        customEndsAt,
        customReason,
        customValues,
        planCode,
        planReason,
        planStatus,
        submitting,
        trialEndsAt,
    } = state;

    const open = company !== null;
    const selectedPlan = useMemo(
        () => catalogue.find((plan) => plan.code === planCode) || null,
        [catalogue, planCode],
    );
    const baseValues = useMemo<EntitlementValues>(
        () => valuesFromEntitlements(access?.base_entitlements || []),
        [access?.base_entitlements],
    );
    const currentValues = useMemo<EntitlementValues>(
        () => valuesFromEntitlements(access?.entitlements || []),
        [access?.entitlements],
    );
    const selectedPlanValues = useMemo<EntitlementValues>(
        () => valuesFromEntitlements(selectedPlan?.entitlements || []),
        [selectedPlan?.entitlements],
    );
    const activeOverrideValues = useMemo<EntitlementValues>(
        () => Object.fromEntries(access?.overrides.map((override) => [override.code, override.value]) || []),
        [access?.overrides],
    );
    const nextPlanValues = useMemo<EntitlementValues>(
        () => ({ ...selectedPlanValues, ...activeOverrideValues }),
        [activeOverrideValues, selectedPlanValues],
    );
    const hasCustomizationChanges = useMemo(
        () => access?.base_entitlements.some((item) => customValues[item.code] !== baseValues[item.code]) ?? false,
        [access?.base_entitlements, baseValues, customValues],
    );
    const currentCustomizationEnd = useMemo(
        () => sharedCustomizationEndDate(access?.overrides || []),
        [access?.overrides],
    );
    const planChanges = useMemo<CommercialChange[]>(() => {
        if (!access || !selectedPlan) return [];
        const currentStatus = access.subscription.status === "trialing" ? "trialing" : "active";
        const changes: CommercialChange[] = [];
        if (access.subscription.plan_code !== planCode) {
            changes.push({
                label: "Plan contratado",
                previous: access.subscription.plan_label,
                next: selectedPlan.label,
                isReduction: PLAN_ORDER.indexOf(planCode) < PLAN_ORDER.indexOf(access.subscription.plan_code),
            });
        }
        if (currentStatus !== planStatus) {
            changes.push({
                label: "Estado de acceso",
                previous: accessStatusLabel(currentStatus),
                next: accessStatusLabel(planStatus),
                isReduction: currentStatus === "active" && planStatus === "trialing",
            });
        }
        const currentTrialEnd = dateForInput(access.subscription.trial_ends_at);
        if (currentTrialEnd !== trialEndsAt) {
            changes.push({
                label: "Fin de la prueba",
                previous: currentTrialEnd || "Sin fecha",
                next: trialEndsAt || "Sin fecha",
                isReduction: Boolean(currentTrialEnd && !trialEndsAt),
            });
        }
        return [...changes, ...entitlementChanges(access.entitlements, currentValues, nextPlanValues)];
    }, [access, currentValues, nextPlanValues, planCode, planStatus, selectedPlan, trialEndsAt]);
    const customizationChanges = useMemo<CommercialChange[]>(() => {
        if (!access) return [];
        const changes = entitlementChanges(access.entitlements, currentValues, customValues);
        if (currentCustomizationEnd !== customEndsAt) {
            changes.push({
                label: "Fin de la configuración",
                previous: currentCustomizationEnd || "Sin fecha",
                next: customEndsAt || "Sin fecha",
                isReduction: Boolean(currentCustomizationEnd && !customEndsAt),
            });
        }
        return changes;
    }, [access, currentCustomizationEnd, currentValues, customEndsAt, customValues]);

    useEffect(() => {
        if (!company) return;
        let cancelled = false;
        dispatch({ type: "load" });
        void Promise.all([
            CompanyPlanAccessService.getCatalogue(),
            CompanyPlanAccessService.get(company.id),
        ]).then(([plans, currentAccess]) => {
            if (cancelled) return;
            dispatch({
                type: "loaded",
                catalogue: [...plans].sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code)),
                access: currentAccess,
            });
        }).catch((error) => {
            if (!cancelled) {
                dispatch({ type: "load-failed" });
                toast.error(error instanceof Error ? error.message : "No se ha podido cargar el plan y acceso");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [company]);

    const close = () => onOpenChange(false);

    const savePlan = async () => {
        if (!company) return;
        try {
            dispatch({ type: "submitting", value: true });
            const updated = await CompanyPlanAccessService.update(company.id, {
                plan_code: planCode,
                status: planStatus,
                trial_ends_at: planStatus === "trialing" ? toIsoEndOfDay(trialEndsAt) : null,
                reason: planReason,
            });
            dispatch({ type: "plan-updated", access: updated });
            onUpdated(updated);
            setConfirmation(null);
            toast.success("Plan y acceso actualizados");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido actualizar el plan");
        } finally {
            dispatch({ type: "submitting", value: false });
        }
    };

    const saveCustomization = async () => {
        if (!company || !access) return;
        try {
            dispatch({ type: "submitting", value: true });
            const updated = await CompanyPlanAccessService.replaceCustomization(company.id, {
                entitlements: access.entitlements.map((item) => ({
                    code: item.code,
                    ...(item.value_type === "boolean"
                        ? { boolean_value: customValues[item.code] === true }
                        : { integer_value: Number(customValues[item.code] ?? 0) }),
                })),
                ends_at: toIsoEndOfDay(customEndsAt),
                reason: customReason,
            });
            dispatch({ type: "override-updated", access: updated });
            onUpdated(updated);
            setConfirmation(null);
            toast.success("Configuración personalizada guardada");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido guardar el acceso personalizado");
        } finally {
            dispatch({ type: "submitting", value: false });
        }
    };

    const resetCustomizationToPlan = () => {
        if (!access) return;
        access.base_entitlements.forEach((item) => {
            dispatch({ type: "custom-value", code: item.code, value: item.value });
        });
        dispatch({ type: "custom-ends-at", value: "" });
    };

    const requestPlanSave = (event: React.FormEvent) => {
        event.preventDefault();
        if (planChanges.length === 0) {
            toast.error("No hay cambios en el plan para guardar");
            return;
        }
        setConfirmation("plan");
    };

    const requestCustomizationSave = (event: React.FormEvent) => {
        event.preventDefault();
        if (customizationChanges.length === 0) {
            toast.error("No hay cambios personalizados para guardar");
            return;
        }
        setConfirmation("custom");
    };

    const planFeatures = selectedPlan?.entitlements.filter((item) => item.value === true) || [];
    const planLimits = selectedPlan?.entitlements.filter((item) => item.value_type === "integer") || [];

    return (
        <>
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
            <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <div className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                        <DialogTitle className="flex items-center gap-2 text-left">
                            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
                            Plan y acceso
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            {company?.name || "Empresa"}. Solo los administradores de plataforma de WorkHive pueden cambiar esta configuración.
                        </DialogDescription>
                    </DialogHeader>

                    {loading || !access ? (
                        <div className="flex min-h-52 flex-1 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-accent" aria-label="Cargando plan y acceso" />
                        </div>
                    ) : (
                        <Tabs className="flex min-h-0 flex-1 flex-col" value={activeTab} onValueChange={(value) => dispatch({ type: "tab", value: value as Tab })}>
                            <div className="shrink-0 px-5 pt-3 sm:px-6">
                                <TabsList className="grid w-full grid-cols-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-1">
                                    <TabsTrigger value="plan" className="rounded-lg px-2 py-2 text-xs font-semibold text-[var(--text-main)] transition-colors hover:bg-accent/10 hover:text-accent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:hover:bg-accent data-[state=active]:hover:text-white">
                                        Plan
                                    </TabsTrigger>
                                    <TabsTrigger value="custom" className="rounded-lg px-2 py-2 text-xs font-semibold text-[var(--text-main)] transition-colors hover:bg-accent/10 hover:text-accent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:hover:bg-accent data-[state=active]:hover:text-white">
                                        Personalizado
                                    </TabsTrigger>
                                    <TabsTrigger value="history" className="rounded-lg px-2 py-2 text-xs font-semibold text-[var(--text-main)] transition-colors hover:bg-accent/10 hover:text-accent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:hover:bg-accent data-[state=active]:hover:text-white">
                                        Historial
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                                {activeTab === "plan" && (
                                    <form className="space-y-5" onSubmit={requestPlanSave}>
                                        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm leading-relaxed text-[var(--text-muted)]">
                                            <span className="font-semibold text-[var(--text-main)]">Paso 1.</span> Elige el plan contratado. Selecciona <span className="font-semibold text-[var(--text-main)]">Prueba</span> solo para un acceso temporal; entonces indicaremos su fecha de finalización.
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="min-w-0 space-y-2">
                                                <Label htmlFor="company-plan">Plan</Label>
                                                <Select value={planCode} onValueChange={(value) => dispatch({ type: "plan-code", value: value as PlanCode })}>
                                                    <SelectTrigger id="company-plan"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {catalogue.filter((plan) => plan.code !== "custom").map((plan) => <SelectItem key={plan.code} value={plan.code}>{plan.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="min-w-0 space-y-2">
                                                <Label htmlFor="company-plan-status">Estado de acceso</Label>
                                                <Select value={planStatus} onValueChange={(value) => {
                                                    const status = value as "active" | "trialing";
                                                    dispatch({ type: "plan-status", value: status });
                                                    if (status === "trialing") {
                                                        dispatch({ type: "plan-code", value: "top" });
                                                        dispatch({ type: "trial-ends-at", value: trialEndsAt || trialEndDate() });
                                                    }
                                                }}>
                                                    <SelectTrigger id="company-plan-status"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Activo</SelectItem>
                                                        <SelectItem value="trialing">Prueba</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {planStatus === "trialing" && (
                                            <div className="max-w-sm space-y-2">
                                                <Label htmlFor="company-trial-end">Fin de la prueba</Label>
                                                <Input id="company-trial-end" required type="date" value={trialEndsAt} onChange={(event) => dispatch({ type: "trial-ends-at", value: event.target.value })} />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label htmlFor="company-plan-reason">Motivo del cambio</Label>
                                            <Textarea id="company-plan-reason" required minLength={3} value={planReason} onChange={(event) => dispatch({ type: "plan-reason", value: event.target.value })} placeholder="Por ejemplo: suscripción anual firmada" />
                                        </div>
                                        <PlanSummary features={planFeatures} limits={planLimits} usage={access.usage} />
                                        <Button type="button" variant="outline" onClick={() => dispatch({ type: "tab", value: "custom" })}>
                                            <SlidersHorizontal className="h-4 w-4" />
                                            Personalizar funciones y capacidad
                                        </Button>
                                        <DialogFooter className="border-t border-[var(--border-soft)] pt-4">
                                            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
                                            <Button type="submit" disabled={submitting || planChanges.length === 0}>
                                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                Guardar plan
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                )}

                                {activeTab === "custom" && (
                                    <form className="space-y-5" onSubmit={requestCustomizationSave}>
                                        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 text-xs leading-relaxed text-[var(--text-muted)] sm:flex-row sm:items-start sm:justify-between">
                                            <p><span className="font-semibold text-[var(--text-main)]">Configuración a medida.</span> Parte del plan contratado y selecciona las funciones y capacidades exactas de esta empresa. Cada diferencia frente al plan queda registrada como una excepción comercial.</p>
                                            <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={!hasCustomizationChanges} onClick={resetCustomizationToPlan}>
                                                Restablecer al plan
                                            </Button>
                                        </div>
                                        <EntitlementConfigurationEditor
                                            entitlements={access.base_entitlements}
                                            values={customValues}
                                            baseValues={baseValues}
                                            onChange={(code, value) => dispatch({ type: "custom-value", code, value })}
                                            idPrefix="company-customization"
                                        />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="custom-end">Fecha de finalización (opcional)</Label>
                                                <Input id="custom-end" type="date" value={customEndsAt} onChange={(event) => dispatch({ type: "custom-ends-at", value: event.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="custom-reason">Motivo comercial</Label>
                                                <Input id="custom-reason" required minLength={3} value={customReason} onChange={(event) => dispatch({ type: "custom-reason", value: event.target.value })} placeholder="Ampliación contratada" />
                                            </div>
                                        </div>
                                        <DialogFooter className="border-t border-[var(--border-soft)] pt-4">
                                            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
                                            <Button type="submit" disabled={submitting || customizationChanges.length === 0}>
                                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
                                                Guardar configuración
                                            </Button>
                                        </DialogFooter>
                                        <OverrideList overrides={access.overrides} />
                                    </form>
                                )}

                                {activeTab === "history" && <AuditList audit={access.audit} subscription={access.subscription} />}
                            </div>
                        </Tabs>
                    )}
                </div>
            </DialogContent>
        </Dialog>
        <CommercialChangeConfirmationDialog
            open={confirmation === "plan"}
            onOpenChange={(nextOpen) => !nextOpen && setConfirmation(null)}
            title="Confirmar cambio de plan"
            description="Revisa el impacto antes de actualizar las condiciones comerciales de esta empresa."
            reason={planReason}
            changes={planChanges}
            confirmLabel="Confirmar cambio de plan"
            onConfirm={() => void savePlan()}
            isSubmitting={submitting}
            note={access?.overrides.length ? "Las excepciones personalizadas activas se conservan y se han incluido en este resumen." : undefined}
        />
        <CommercialChangeConfirmationDialog
            open={confirmation === "custom"}
            onOpenChange={(nextOpen) => !nextOpen && setConfirmation(null)}
            title="Confirmar configuración personalizada"
            description="Esta operación modifica las funciones o capacidades específicas de la empresa."
            reason={customReason}
            changes={customizationChanges}
            confirmLabel="Guardar configuración"
            onConfirm={() => void saveCustomization()}
            isSubmitting={submitting}
            note="Las capacidades se validarán frente al uso actual antes de guardar."
        />
        </>
    );
}

function PlanSummary({
    features,
    limits,
    usage,
}: {
    features: Entitlement[];
    limits: Entitlement[];
    usage: CompanyPlanAccess["usage"];
}) {
    const usageByLabel: Record<string, number> = {
        Administradores: usage.administrators,
        Responsables: usage.managers,
        Trabajadores: usage.workers,
        Departamentos: usage.departments,
        Equipos: usage.teams,
    };
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-[var(--border-soft)] p-3">
                <h3 className="text-sm font-semibold text-[var(--text-main)]">Funciones incluidas</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {features.map((item) => <Badge key={item.code} variant="outline" className="border-accent/30 bg-accent/10 text-accent">{item.label}</Badge>)}
                </div>
            </section>
            <section className="min-w-0 rounded-xl border border-[var(--border-soft)] p-3">
                <h3 className="text-sm font-semibold text-[var(--text-main)]">Capacidad</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Uso actual frente al límite del plan.</p>
                <dl className="mt-2 space-y-1.5 text-xs">
                    {limits.map((item) => <div className="flex items-center justify-between gap-3" key={item.code}><dt className="min-w-0 truncate text-[var(--text-muted)]">{item.label}</dt><dd className="shrink-0 font-semibold text-[var(--text-main)]">{usageByLabel[item.label] ?? "—"} / {item.value}</dd></div>)}
                </dl>
            </section>
        </div>
    );
}

function OverrideList({ overrides }: { overrides: CompanyPlanAccess["overrides"] }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Accesos personalizados activos</h3>
            {overrides.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No hay reglas de acceso personalizado activas.</p> : overrides.map((override) => (
                <article key={override.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-[var(--border-soft)] p-3">
                    <div className="min-w-0"><p className="font-medium text-[var(--text-main)]">{override.label}: {String(override.value)}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{override.reason}</p></div>
                    {override.ends_at && <Badge variant="outline" className="shrink-0"><CalendarClock className="h-3 w-3" />Hasta {dateForInput(override.ends_at)}</Badge>}
                </article>
            ))}
        </section>
    );
}

function AuditList({
    audit,
    subscription,
}: {
    audit: CompanyPlanAccess["audit"];
    subscription: CompanyPlanAccess["subscription"];
}) {
    return (
        <section className="space-y-2">
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 p-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">Configuración actual</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {subscription.plan_label}{subscription.plan_version ? ` · versión ${subscription.plan_version}` : ""} · {subscription.status === "trialing" ? "Prueba" : "Activo"}
                </p>
            </div>
            {audit.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Todavía no hay cambios manuales registrados. Este panel muestra sólo operaciones reales: aparecerán aquí al cambiar el plan o al guardar una configuración personalizada, con su motivo.</p> : audit.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-[var(--border-soft)] p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-medium text-[var(--text-main)]">{auditLabel(entry.action)}</p><time className="shrink-0 text-xs text-[var(--text-muted)]">{dateForInput(entry.created_at)}</time></div>
                    {entry.reason && <p className="mt-1 text-sm text-[var(--text-muted)]">{entry.reason}</p>}
                </article>
            ))}
        </section>
    );
}
