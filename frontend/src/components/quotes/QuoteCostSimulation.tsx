"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useUser } from "@/lib/user-context";
import { canViewLaborCosts } from "@/domain/access/roles";
import { quoteCosts, type CostInputs } from "@/services/quote-cost-estimate.service";
import { formatCurrency } from "@/lib/format";
import type { Quote } from "@/types/quote";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const labels: Record<keyof CostInputs, string> = { labor_hours: "Horas previstas", hourly_cost: "Coste por hora (€)", materials: "Materiales (€)", other_costs: "Otros costes (€)" };
export function QuoteCostSimulation({ quote, canManage }: {
    quote: Quote;
    canManage: boolean;
}) {
    const { user } = useUser();
    const allowed = canViewLaborCosts(user);
    const [draft, setDraft] = useState<CostInputs | null>(null);
    const [exactLabor,setExactLabor]=useState<string|null>(null);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let active = true;
        if (allowed)
            quoteCosts(quote.id).then(data => {
                if (active) {
                    setDraft(data.estimate ?? { labor_hours: "0", hourly_cost: "0", materials: "0", other_costs: "0" });
                    setExactLabor(data.labor_amount);
                    setSaved(Boolean(data.estimate));
                }
            }).catch(e => { if (active)
                setError(e.message); });
        return () => { active = false; };
    }, [quote.id, allowed]);
    if (!allowed)
        return null;
    const total = draft ? (exactLabor!==null?Number(exactLabor):Number(draft.labor_hours) * Number(draft.hourly_cost)) + Number(draft.materials) + Number(draft.other_costs) : 0;
    const editable = canManage && (quote.status === "draft" || quote.status === "sent");
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft) return;
        setBusy(true);
        setError("");
        try {
            await quoteCosts(quote.id, { ...draft, revision: quote.revision_number });
            setSaved(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
        } finally {
            setBusy(false);
        }
    }
    return <section className="mt-4 rounded-xl border p-4 print:hidden"><h3 className="font-semibold">Simulación de costes y margen</h3>
        <p className="mb-3 text-xs text-muted-foreground">Previsión interna de esta revisión. Al aceptar, se vincula con el presupuesto de costes del contrato.</p>
        {exactLabor!==null&&<p className="mb-3 text-xs text-muted-foreground">Coste exacto de personal desde la calculadora: {formatCurrency(Number(exactLabor))}. Las horas y la tarifa se muestran redondeadas. Editar un campo inicia una simulación manual.</p>}
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        {draft && <form onSubmit={event => void handleSubmit(event)}>
        <fieldset disabled={!editable || busy} className="grid gap-3 sm:grid-cols-4">{(Object.keys(labels) as (keyof CostInputs)[]).map(key => <label key={key} className="text-xs">{labels[key]}<Input type="number" min="0" max={key === "labor_hours" || key === "hourly_cost" ? 100000 : 9999999999} step=".01" required value={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.value });setExactLabor(null); setSaved(false); }}/></label>)}</fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><span>Ingreso sin impuestos <strong>{formatCurrency(quote.base_amount)}</strong></span><span>Coste <strong>{formatCurrency(total)}</strong></span><span className={quote.base_amount - total < 0 ? "text-orange-700" : ""}>Margen <strong>{formatCurrency(quote.base_amount - total)}</strong></span>
        {editable && <Button size="sm" disabled={busy || saved}>{saved ? "Previsión guardada" : "Guardar previsión"}</Button>}</div></form>}
    </section>;
}
