"use client";

import * as React from "react";
import { ChartNoAxesCombined, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { MarginForecastService } from "@/services/margin-forecast.service";
import type { MarginForecastScopeType, MarginForecast } from "@/types/margin-forecast";

type MarginForecastPanelProps = {
    scopeType: MarginForecastScopeType;
    scopeId: number;
    canManage: boolean;
    className?: string;
};

function Metric({ label, value, tone = "default" }: { label: string; value: number | null; tone?: "default" | "positive" | "negative" }) {
    const color = tone === "positive"
        ? "text-emerald-700 dark:text-emerald-300"
        : tone === "negative"
            ? "text-red-700 dark:text-red-300"
            : "text-[var(--text-main)]";
    return <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value === null ? "—" : formatCurrency(value)}</p></div>;
}

function marginTone(value: number | null): "default" | "positive" | "negative" {
    if (value === null) return "default";
    return value >= 0 ? "positive" : "negative";
}

export function MarginForecastPanel({ scopeType, scopeId, canManage, className = "" }: MarginForecastPanelProps) {
    const [forecast, setForecast] = React.useState<MarginForecast | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [plannedCost, setPlannedCost] = React.useState("");
    const [notes, setNotes] = React.useState("");

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const next = await MarginForecastService.get(scopeType, scopeId);
            setForecast(next);
            setPlannedCost(next.budget?.planned_direct_cost_amount.toString() ?? "");
            setNotes(next.budget?.notes ?? "");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo cargar el margen previsto"));
        } finally {
            setLoading(false);
        }
    }, [scopeId, scopeType]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const save = async () => {
        const amount = Number(plannedCost);
        if (!Number.isFinite(amount) || amount < 0) {
            toast.error("Introduce un coste directo previsto válido.");
            return;
        }
        setSaving(true);
        try {
            const next = await MarginForecastService.save(scopeType, scopeId, {
                planned_direct_cost_amount: amount,
                notes: notes.trim() || null,
            });
            setForecast(next);
            setPlannedCost(next.budget?.planned_direct_cost_amount.toString() ?? "");
            setNotes(next.budget?.notes ?? "");
            toast.success("Presupuesto de coste guardado.");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo guardar el presupuesto de coste"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className={`flex min-h-32 items-center justify-center text-[var(--text-muted)] ${className}`}><Loader2 className="size-5 animate-spin" aria-label="Cargando margen" /></div>;
    if (!forecast) return null;

    const scopeLabel = scopeType === "contract" ? "contrato" : "orden";
    return (
        <section className={`border-b border-[var(--border-soft)] py-5 ${className}`} aria-label={`Margen de ${scopeLabel}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent"><ChartNoAxesCombined className="size-4" aria-hidden="true" /></span>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-main)]">Margen previsto frente a trazado</h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Solo factura de tareas, mano de obra con snapshot y material consumido sin reversión. Los gastos generales no se reparten.</p>
                    </div>
                </div>
                {!forecast.budget && <span className="rounded-full bg-[var(--alert-warning-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--alert-warning-text)]">Falta presupuesto de coste</span>}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Ingreso previsto" value={forecast.planned_revenue_base_amount} />
                <Metric label="Coste previsto" value={forecast.planned_direct_cost_base_amount} />
                <Metric label="Margen previsto" value={forecast.planned_margin_base_amount} tone={marginTone(forecast.planned_margin_base_amount)} />
                <Metric label="Margen trazado" value={forecast.actual_margin_base_amount} tone={marginTone(forecast.actual_margin_base_amount)} />
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Facturado trazado: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_revenue_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Mano de obra: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_labor_cost_base_amount)}</span> · Material: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_material_cost_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Desviación de coste: <span className={`font-mono font-semibold ${marginTone(forecast.direct_cost_variance_base_amount) === "negative" ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--text-main)]"}`}>{forecast.direct_cost_variance_base_amount === null ? "—" : formatCurrency(forecast.direct_cost_variance_base_amount)}</span></p>
            </div>

            {canManage && <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
                    <div className="space-y-1.5"><Label htmlFor={`${scopeType}-planned-cost-${scopeId}`}>Coste directo previsto (€)</Label><Input id={`${scopeType}-planned-cost-${scopeId}`} type="number" min="0" step="0.01" value={plannedCost} onChange={(event) => setPlannedCost(event.target.value)} disabled={saving} /></div>
                    <div className="space-y-1.5"><Label htmlFor={`${scopeType}-forecast-notes-${scopeId}`}>Base de cálculo interna</Label><Textarea id={`${scopeType}-forecast-notes-${scopeId}`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={2} disabled={saving} placeholder="Ej.: 4 h de equipo y material estimado" /></div>
                    <Button type="button" onClick={() => void save()} disabled={saving || !plannedCost.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar coste</Button>
                </div>
            </div>}
        </section>
    );
}
