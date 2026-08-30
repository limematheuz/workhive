import { useEffect, useMemo, useReducer, useState, type FormEvent } from "react";

import { toast } from "@/lib/toast";
import {
    CompanyPlanAccessService,
    type CompanyPlanAccess,
    type Entitlement,
    type PlanCatalogueItem,
    type PlanCode,
} from "@/services/company-plan-access.service";
import type { Company } from "@/services/company.service";
import type { EntitlementValues } from "./EntitlementConfigurationEditor";
import { entitlementChanges, type CommercialChange } from "./commercial-change-utils";

export type CompanyPlanAccessTab = "plan" | "custom" | "history";

const PLAN_ORDER: PlanCode[] = ["basic", "medium", "top", "mega", "custom"];

type State = {
    catalogue: PlanCatalogueItem[];
    access: CompanyPlanAccess | null;
    activeTab: CompanyPlanAccessTab;
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

type Action =
    | { type: "load" }
    | { type: "loaded"; catalogue: PlanCatalogueItem[]; access: CompanyPlanAccess }
    | { type: "load-failed" }
    | { type: "tab"; value: CompanyPlanAccessTab }
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

const INITIAL_STATE: State = {
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

export function dateForInput(value: string | null | undefined): string {
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

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "load": return { ...state, loading: true, access: null, activeTab: "plan" };
        case "loaded": return {
            ...state,
            loading: false,
            catalogue: action.catalogue,
            access: action.access,
            planCode: action.access.subscription.plan_code,
            planStatus: action.access.subscription.status === "trialing" ? "trialing" : "active",
            trialEndsAt: dateForInput(action.access.subscription.trial_ends_at),
            customValues: valuesFromEntitlements(action.access.entitlements),
            customEndsAt: sharedCustomizationEndDate(action.access.overrides),
        };
        case "load-failed": return { ...state, loading: false };
        case "tab": return { ...state, activeTab: action.value };
        case "submitting": return { ...state, submitting: action.value };
        case "plan-code": return { ...state, planCode: action.value };
        case "plan-status": return { ...state, planStatus: action.value };
        case "trial-ends-at": return { ...state, trialEndsAt: action.value };
        case "plan-reason": return { ...state, planReason: action.value };
        case "custom-value": return { ...state, customValues: { ...state.customValues, [action.code]: action.value } };
        case "custom-ends-at": return { ...state, customEndsAt: action.value };
        case "custom-reason": return { ...state, customReason: action.value };
        case "plan-updated": return {
            ...state,
            access: action.access,
            planReason: "",
            customValues: valuesFromEntitlements(action.access.entitlements),
        };
        case "override-updated": return {
            ...state,
            access: action.access,
            customValues: valuesFromEntitlements(action.access.entitlements),
            customReason: "",
            customEndsAt: sharedCustomizationEndDate(action.access.overrides),
        };
    }
}

export function auditLabel(action: string): string {
    const labels: Record<string, string> = {
        "subscription.manually_changed": "Plan actualizado",
        "entitlement.override_set": "Acceso personalizado actualizado",
        "entitlement.customization_replaced": "Configuración personalizada actualizada",
        "subscription.synchronized": "Plan sincronizado",
    };
    return labels[action] || "Plan y acceso actualizados";
}

export function useCompanyPlanAccessDialog({
    company,
    onOpenChange,
    onUpdated,
}: {
    company: Company | null;
    onOpenChange: (open: boolean) => void;
    onUpdated: (access: CompanyPlanAccess) => void;
}) {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const [confirmation, setConfirmation] = useState<"plan" | "custom" | null>(null);
    const { access, catalogue, customEndsAt, customReason, customValues, planCode, planReason, planStatus, trialEndsAt } = state;
    const selectedPlan = useMemo(() => catalogue.find((plan) => plan.code === planCode) || null, [catalogue, planCode]);
    const baseValues = useMemo(() => valuesFromEntitlements(access?.base_entitlements || []), [access?.base_entitlements]);
    const currentValues = useMemo(() => valuesFromEntitlements(access?.entitlements || []), [access?.entitlements]);
    const selectedPlanValues = useMemo(() => valuesFromEntitlements(selectedPlan?.entitlements || []), [selectedPlan?.entitlements]);
    const activeOverrideValues = useMemo(() => Object.fromEntries(access?.overrides.map((item) => [item.code, item.value]) || []), [access?.overrides]);
    const nextPlanValues = useMemo(() => ({ ...selectedPlanValues, ...activeOverrideValues }), [activeOverrideValues, selectedPlanValues]);
    const currentCustomizationEnd = useMemo(() => sharedCustomizationEndDate(access?.overrides || []), [access?.overrides]);
    const hasCustomizationChanges = access?.base_entitlements.some((item) => customValues[item.code] !== baseValues[item.code]) ?? false;
    const planChanges = useMemo<CommercialChange[]>(() => {
        if (!access || !selectedPlan) return [];
        const changes: CommercialChange[] = [];
        const currentStatus = access.subscription.status === "trialing" ? "trialing" : "active";
        if (access.subscription.plan_code !== planCode) changes.push({
            label: "Plan contratado", previous: access.subscription.plan_label, next: selectedPlan.label,
            isReduction: PLAN_ORDER.indexOf(planCode) < PLAN_ORDER.indexOf(access.subscription.plan_code),
        });
        if (currentStatus !== planStatus) changes.push({
            label: "Estado de acceso", previous: accessStatusLabel(currentStatus), next: accessStatusLabel(planStatus),
            isReduction: currentStatus === "active" && planStatus === "trialing",
        });
        const currentTrialEnd = dateForInput(access.subscription.trial_ends_at);
        if (currentTrialEnd !== trialEndsAt) changes.push({
            label: "Fin de la prueba", previous: currentTrialEnd || "Sin fecha", next: trialEndsAt || "Sin fecha",
            isReduction: Boolean(currentTrialEnd && !trialEndsAt),
        });
        return [...changes, ...entitlementChanges(access.entitlements, currentValues, nextPlanValues)];
    }, [access, currentValues, nextPlanValues, planCode, planStatus, selectedPlan, trialEndsAt]);
    const customizationChanges = useMemo<CommercialChange[]>(() => {
        if (!access) return [];
        const changes = entitlementChanges(access.entitlements, currentValues, customValues);
        if (currentCustomizationEnd !== customEndsAt) changes.push({
            label: "Fin de la configuración", previous: currentCustomizationEnd || "Sin fecha", next: customEndsAt || "Sin fecha",
            isReduction: Boolean(currentCustomizationEnd && !customEndsAt),
        });
        return changes;
    }, [access, currentCustomizationEnd, currentValues, customEndsAt, customValues]);

    useEffect(() => {
        if (!company) return;
        let cancelled = false;
        dispatch({ type: "load" });
        void Promise.all([CompanyPlanAccessService.getCatalogue(), CompanyPlanAccessService.get(company.id)])
            .then(([plans, currentAccess]) => {
                if (!cancelled) dispatch({
                    type: "loaded",
                    catalogue: [...plans].sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code)),
                    access: currentAccess,
                });
            })
            .catch((error) => {
                if (!cancelled) {
                    dispatch({ type: "load-failed" });
                    toast.error(error instanceof Error ? error.message : "No se ha podido cargar el plan y acceso");
                }
            });
        return () => { cancelled = true; };
    }, [company]);

    const savePlan = async () => {
        if (!company) return;
        try {
            dispatch({ type: "submitting", value: true });
            const updated = await CompanyPlanAccessService.update(company.id, {
                plan_code: planCode, status: planStatus,
                trial_ends_at: planStatus === "trialing" ? toIsoEndOfDay(trialEndsAt) : null,
                reason: planReason,
            });
            dispatch({ type: "plan-updated", access: updated });
            onUpdated(updated);
            setConfirmation(null);
            toast.success("Plan y acceso actualizados");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido actualizar el plan");
        } finally { dispatch({ type: "submitting", value: false }); }
    };

    const saveCustomization = async () => {
        if (!company || !access) return;
        try {
            dispatch({ type: "submitting", value: true });
            const updated = await CompanyPlanAccessService.replaceCustomization(company.id, {
                entitlements: access.entitlements.map((item) => ({
                    code: item.code,
                    ...(item.value_type === "boolean" ? { boolean_value: customValues[item.code] === true } : { integer_value: Number(customValues[item.code] ?? 0) }),
                })),
                ends_at: toIsoEndOfDay(customEndsAt), reason: customReason,
            });
            dispatch({ type: "override-updated", access: updated });
            onUpdated(updated);
            setConfirmation(null);
            toast.success("Configuración personalizada guardada");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido guardar el acceso personalizado");
        } finally { dispatch({ type: "submitting", value: false }); }
    };

    const requestPlanSave = (event: FormEvent) => {
        event.preventDefault();
        if (planChanges.length === 0) return toast.error("No hay cambios en el plan para guardar");
        setConfirmation("plan");
    };
    const requestCustomizationSave = (event: FormEvent) => {
        event.preventDefault();
        if (customizationChanges.length === 0) return toast.error("No hay cambios personalizados para guardar");
        setConfirmation("custom");
    };
    const resetCustomizationToPlan = () => {
        if (!access) return;
        for (const entitlement of access.base_entitlements) dispatch({ type: "custom-value", code: entitlement.code, value: entitlement.value });
        dispatch({ type: "custom-ends-at", value: "" });
    };
    const planFeatures: Entitlement[] = [];
    const planLimits: Entitlement[] = [];
    const selectablePlans: PlanCatalogueItem[] = [];
    for (const plan of catalogue) {
        if (plan.code !== "custom") selectablePlans.push(plan);
    }
    for (const entitlement of selectedPlan?.entitlements || []) {
        if (entitlement.value === true) planFeatures.push(entitlement);
        if (entitlement.value_type === "integer") planLimits.push(entitlement);
    }

    return {
        ...state,
        open: company !== null,
        companyName: company?.name || "Empresa",
        confirmation,
        access,
        baseValues,
        planChanges,
        customizationChanges,
        hasCustomizationChanges,
        planFeatures,
        planLimits,
        selectablePlans,
        close: () => onOpenChange(false),
        dismissConfirmation: () => setConfirmation(null),
        setActiveTab: (value: CompanyPlanAccessTab) => dispatch({ type: "tab", value }),
        setPlanCode: (value: PlanCode) => dispatch({ type: "plan-code", value }),
        setPlanStatus: (value: "active" | "trialing") => {
            dispatch({ type: "plan-status", value });
            if (value === "trialing") {
                dispatch({ type: "plan-code", value: "top" });
                dispatch({ type: "trial-ends-at", value: trialEndsAt || trialEndDate() });
            }
        },
        setTrialEndsAt: (value: string) => dispatch({ type: "trial-ends-at", value }),
        setPlanReason: (value: string) => dispatch({ type: "plan-reason", value }),
        setCustomValue: (code: string, value: boolean | number) => dispatch({ type: "custom-value", code, value }),
        setCustomEndsAt: (value: string) => dispatch({ type: "custom-ends-at", value }),
        setCustomReason: (value: string) => dispatch({ type: "custom-reason", value }),
        resetCustomizationToPlan,
        requestPlanSave,
        requestCustomizationSave,
        savePlan,
        saveCustomization,
    };
}
