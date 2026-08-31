"use client";

import { CheckCircle2, Minus, Plus, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Entitlement, EntitlementValue } from "@/services/company-plan-access.service";

export type EntitlementValues = Record<string, EntitlementValue>;

type EntitlementConfigurationEditorProps = {
    entitlements: Entitlement[];
    values: EntitlementValues;
    baseValues?: EntitlementValues;
    onChange: (code: string, value: EntitlementValue) => void;
    idPrefix: string;
    description?: string;
};

function isChanged(code: string, values: EntitlementValues, baseValues?: EntitlementValues) {
    return baseValues !== undefined && values[code] !== baseValues[code];
}

export function EntitlementConfigurationEditor({
    entitlements,
    values,
    baseValues,
    onChange,
    idPrefix,
    description,
}: EntitlementConfigurationEditorProps) {
    const features = entitlements.filter((item) => item.value_type === "boolean");
    const capacities = entitlements.filter((item) => item.value_type === "integer");
    const enabledFeatures = features.filter((item) => values[item.code] === true).length;
    const allFeaturesSelected = features.length > 0 && enabledFeatures === features.length;

    const setAllFeatures = (selected: boolean) => {
        features.forEach((item) => onChange(item.code, selected));
    };

    return (
        <div className="space-y-5">
            {description && <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>}

            <section className="rounded-xl border border-[var(--border-soft)] p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                            <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
                            Funciones disponibles
                        </h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Marca exactamente lo que podrá usar esta empresa.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="w-fit border-accent/25 bg-accent/10 text-accent">
                            {enabledFeatures} de {features.length} activas
                        </Badge>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={allFeaturesSelected}
                            onClick={() => setAllFeatures(true)}
                        >
                            Seleccionar todas
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={enabledFeatures === 0}
                            onClick={() => setAllFeatures(false)}
                        >
                            Deseleccionar todas
                        </Button>
                    </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {features.map((item) => {
                        const changed = isChanged(item.code, values, baseValues);
                        const inputId = `${idPrefix}-${item.code.replaceAll(".", "-")}`;
                        return (
                            <Label
                                htmlFor={inputId}
                                key={item.code}
                                className={cn(
                                    "flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left normal-case tracking-normal transition-colors hover:border-accent/40 hover:bg-accent/5",
                                    values[item.code] === true ? "border-accent/35 bg-accent/5" : "border-[var(--border-soft)]",
                                )}
                            >
                                <Checkbox
                                    id={inputId}
                                    checked={values[item.code] === true}
                                    onCheckedChange={(checked) => onChange(item.code, checked === true)}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-[var(--text-main)]">{item.label}</span>
                                    {baseValues && (
                                        <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                                            {changed ? "Configuración personalizada" : "Incluida por el plan"}
                                        </span>
                                    )}
                                </span>
                            </Label>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-xl border border-[var(--border-soft)] p-3 sm:p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                    <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
                    Capacidades
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Define el máximo de personas y espacios. Usa los controles o escribe la cifra exacta.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {capacities.map((item) => {
                        const changed = isChanged(item.code, values, baseValues);
                        const inputId = `${idPrefix}-${item.code.replaceAll(".", "-")}`;
                        return (
                            <div className="min-w-0 space-y-1.5" key={item.code}>
                                <Label htmlFor={inputId} className="flex items-center justify-between gap-2 normal-case tracking-normal">
                                    <span className="truncate">{item.label}</span>
                                    {baseValues && changed && <span className="shrink-0 text-[10px] font-semibold text-accent">Personalizado</span>}
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        aria-label={`Reducir ${item.label}`}
                                        disabled={Number(values[item.code] ?? 0) <= 0}
                                        onClick={() => onChange(item.code, Math.max(0, Number(values[item.code] ?? 0) - 1))}
                                    >
                                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                    <Input
                                        id={inputId}
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputMode="numeric"
                                        className="text-center tabular-nums"
                                        value={String(values[item.code] ?? 0)}
                                        onChange={(event) => onChange(item.code, Math.max(0, Number(event.target.value) || 0))}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        aria-label={`Aumentar ${item.label}`}
                                        onClick={() => onChange(item.code, Number(values[item.code] ?? 0) + 1)}
                                    >
                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                </div>
                                {baseValues && <p className="text-[11px] text-[var(--text-muted)]">Plan: {baseValues[item.code] ?? 0}</p>}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
