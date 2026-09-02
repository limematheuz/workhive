"use client";

import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { startTransition, useEffect, useMemo, useReducer } from "react";

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
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { toast } from "@/lib/toast";
import {
    CompanyPlanAccessService,
    type PlanCatalogueItem,
    type PlanCode,
} from "@/services/company-plan-access.service";
import { EntitlementConfigurationEditor, type EntitlementValues } from "./EntitlementConfigurationEditor";
import {
    CommercialChangeConfirmationDialog,
} from "./CommercialChangeConfirmationDialog";
import { entitlementChanges, type CommercialChange } from "./commercial-change-utils";

type StandardPlanCode = Exclude<PlanCode, "custom">;

const STANDARD_PLAN_ORDER: StandardPlanCode[] = ["basic", "medium", "top", "mega"];

type PlanCatalogEditorDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

function valuesForPlan(plan: PlanCatalogueItem | undefined): EntitlementValues {
    return Object.fromEntries(plan?.entitlements.map((item) => [item.code, item.value]) || []);
}

type PlanCatalogState = {
    catalogue: PlanCatalogueItem[];
    selectedCode: StandardPlanCode;
    draftValues: EntitlementValues;
    reason: string;
    loading: boolean;
    saving: boolean;
    confirmationOpen: boolean;
};

type PlanCatalogAction =
    | { type: "loading"; value: boolean }
    | { type: "loaded"; catalogue: PlanCatalogueItem[]; selectedCode: StandardPlanCode; draftValues: EntitlementValues }
    | { type: "select"; code: StandardPlanCode; draftValues: EntitlementValues }
    | { type: "value"; code: string; value: boolean | number }
    | { type: "reason"; value: string }
    | { type: "saving"; value: boolean }
    | { type: "confirmation"; value: boolean }
    | { type: "published"; plan: PlanCatalogueItem };

const INITIAL_STATE: PlanCatalogState = {
    catalogue: [],
    selectedCode: "basic",
    draftValues: {},
    reason: "",
    loading: false,
    saving: false,
    confirmationOpen: false,
};

function reducer(state: PlanCatalogState, action: PlanCatalogAction): PlanCatalogState {
    switch (action.type) {
        case "loading": return { ...state, loading: action.value };
        case "loaded": return { ...state, ...action, loading: false };
        case "select": return { ...state, selectedCode: action.code, draftValues: action.draftValues, reason: "" };
        case "value": return { ...state, draftValues: { ...state.draftValues, [action.code]: action.value } };
        case "reason": return { ...state, reason: action.value };
        case "saving": return { ...state, saving: action.value };
        case "confirmation": return { ...state, confirmationOpen: action.value };
        case "published": return {
            ...state,
            catalogue: state.catalogue.map((plan) => plan.code === action.plan.code ? action.plan : plan),
            draftValues: valuesForPlan(action.plan),
            reason: "",
            confirmationOpen: false,
        };
    }
}

export function PlanCatalogEditorDialog({ open, onOpenChange }: PlanCatalogEditorDialogProps) {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const { catalogue, selectedCode, draftValues, reason, loading, saving, confirmationOpen } = state;

    const selectedPlan = useMemo(
        () => catalogue.find((plan) => plan.code === selectedCode),
        [catalogue, selectedCode],
    );

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        startTransition(() => dispatch({ type: "loading", value: true }));
        void CompanyPlanAccessService.getCatalogue().then((plans) => {
            if (cancelled) return;
            const available = plans.filter((plan): plan is PlanCatalogueItem & { code: StandardPlanCode } => plan.code !== "custom");
            const first = available.find((plan) => plan.code === "basic") || available[0];
            if (first) {
                dispatch({
                    type: "loaded",
                    catalogue: available,
                    selectedCode: first.code,
                    draftValues: valuesForPlan(first),
                });
            }
        }).catch((error) => {
            if (!cancelled) toast.error(error instanceof Error ? error.message : "No se han podido cargar los planes");
        }).finally(() => {
            if (!cancelled) dispatch({ type: "loading", value: false });
        });
        return () => {
            cancelled = true;
        };
    }, [open]);

    const selectPlan = (code: string) => {
        const nextCode = code as StandardPlanCode;
        const nextPlan = catalogue.find((plan) => plan.code === nextCode);
        dispatch({ type: "select", code: nextCode, draftValues: valuesForPlan(nextPlan) });
    };

    const changes = useMemo<CommercialChange[]>(
        () => selectedPlan
            ? entitlementChanges(selectedPlan.entitlements, valuesForPlan(selectedPlan), draftValues)
            : [],
        [draftValues, selectedPlan],
    );

    const save = async () => {
        if (!selectedPlan) return;
        try {
            dispatch({ type: "saving", value: true });
            const updated = await CompanyPlanAccessService.updatePlanCatalog(selectedCode, {
                entitlements: selectedPlan.entitlements.map((item) => ({
                    code: item.code,
                    ...(item.value_type === "boolean"
                        ? { boolean_value: draftValues[item.code] === true }
                        : { integer_value: Number(draftValues[item.code] ?? 0) }),
                })),
                reason,
            });
            dispatch({ type: "published", plan: updated });
            toast.success(`${updated.label} se ha publicado como versión ${updated.version}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se ha podido publicar el plan");
        } finally {
            dispatch({ type: "saving", value: false });
        }
    };

    const requestSave = (event: React.FormEvent) => {
        event.preventDefault();
        if (changes.length === 0) {
            toast.error("No hay cambios en este plan para publicar");
            return;
        }
        dispatch({ type: "confirmation", value: true });
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-left">
                        <SlidersHorizontal className="h-5 w-5 text-accent" aria-hidden="true" />
                        Gestionar planes
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        Define qué incluye cada plan estándar. Al publicar, las nuevas contrataciones usarán esta versión; las empresas existentes conservan sus condiciones actuales.
                    </DialogDescription>
                </DialogHeader>

                {loading || !selectedPlan ? (
                    <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" aria-label="Cargando planes" /></div>
                ) : (
                    <form className="flex min-h-0 flex-1 flex-col" onSubmit={requestSave}>
                        <div className="shrink-0 px-5 pt-3 sm:px-6">
                            <PremiumTabs
                                tabs={STANDARD_PLAN_ORDER.map((code) => ({
                                    id: code,
                                    label: catalogue.find((item) => item.code === code)?.label || code,
                                }))}
                                activeTab={selectedCode}
                                onChange={selectPlan}
                                mobileLabel="Plan que quieres editar"
                            />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                            <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm text-[var(--text-muted)]">
                                Editando <span className="font-semibold text-[var(--text-main)]">{selectedPlan.label}</span>, versión {selectedPlan.version}. Activa o desactiva funciones y ajusta los límites antes de publicar una nueva versión.
                            </div>
                            <EntitlementConfigurationEditor
                                entitlements={selectedPlan.entitlements}
                                values={draftValues}
                                onChange={(code, value) => dispatch({ type: "value", code, value })}
                                idPrefix={`plan-${selectedCode}`}
                            />
                            <div className="mt-5 space-y-2">
                                <Label htmlFor="plan-publication-reason">Motivo de esta nueva versión</Label>
                                <Input id="plan-publication-reason" required minLength={3} value={reason} onChange={(event) => dispatch({ type: "reason", value: event.target.value })} placeholder="Por ejemplo: nueva tarifa anual" />
                            </div>
                        </div>
                        <DialogFooter className="shrink-0 border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saving || changes.length === 0}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Publicar nueva versión
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
        <CommercialChangeConfirmationDialog
            open={confirmationOpen}
            onOpenChange={(value) => dispatch({ type: "confirmation", value })}
            title={`Publicar una nueva versión de ${selectedPlan?.label || "este plan"}`}
            description="Las nuevas contrataciones usarán esta versión. Las empresas existentes mantienen la versión que ya contrataron."
            reason={reason}
            changes={changes}
            confirmLabel="Publicar nueva versión"
            onConfirm={() => void save()}
            isSubmitting={saving}
            note={selectedPlan ? `Se publicará la versión ${selectedPlan.version + 1}.` : undefined}
        />
        </>
    );
}
