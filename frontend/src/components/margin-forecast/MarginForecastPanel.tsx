"use client";

import * as React from "react";
import { ChartNoAxesCombined, CircleDollarSign, HandCoins, Loader2, ReceiptText, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SummaryMetricCard, SummaryMetricGrid, type SummaryMetricTone } from "@/components/ui/summary-metric-card";
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

function marginTone(value: number | null): SummaryMetricTone {
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
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Solo factura de tareas, mano de obra con snapshot, material consumido y gastos vinculados explícitamente. Los gastos generales no se reparten.</p>
                    </div>
                </div>
                {!forecast.budget && <Badge variant="outline" className="border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]">Falta presupuesto de coste</Badge>}
            </div>

            <SummaryMetricGrid className="mt-4" desktopColumns={4} aria-label={`Resumen de margen de ${scopeLabel}`}>
                <SummaryMetricCard icon={ReceiptText} label="Ingreso previsto" value={forecast.planned_revenue_base_amount === null ? "—" : formatCurrency(forecast.planned_revenue_base_amount)} />
                <SummaryMetricCard icon={CircleDollarSign} label="Coste previsto" value={forecast.planned_direct_cost_base_amount === null ? "—" : formatCurrency(forecast.planned_direct_cost_base_amount)} />
                <SummaryMetricCard icon={ChartNoAxesCombined} label="Margen previsto" value={forecast.planned_margin_base_amount === null ? "—" : formatCurrency(forecast.planned_margin_base_amount)} valueTone={marginTone(forecast.planned_margin_base_amount)} />
                <SummaryMetricCard icon={HandCoins} label="Margen trazado" value={formatCurrency(forecast.actual_margin_base_amount)} valueTone={marginTone(forecast.actual_margin_base_amount)} />
            </SummaryMetricGrid>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Facturado trazado: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_revenue_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Mano de obra: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_labor_cost_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Material: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_material_cost_base_amount)}</span> · Gastos directos: <span className="font-mono font-semibold text-[var(--text-main)]">{formatCurrency(forecast.actual_expense_cost_base_amount)}</span></p>
                <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-muted)]">Desviación de coste: <span className={`font-mono font-semibold ${marginTone(forecast.direct_cost_variance_base_amount) === "negative" ? "text-[var(--status-active-text)]" : "text-[var(--text-main)]"}`}>{forecast.direct_cost_variance_base_amount === null ? "—" : formatCurrency(forecast.direct_cost_variance_base_amount)}</span></p>
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
