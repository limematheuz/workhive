import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCurrency } from "@/lib/format";
import type { ApprovedPurchaseBudget } from "@/services/workflow-approval.service";

export function PurchaseBudgetSelector({ budgets, value, onChange, total }: { budgets: ApprovedPurchaseBudget[]; value: number | null; onChange: (value: number | null) => void; total: number }) {
    const selected = budgets.find(item => item.id === value);
    const exceeds = selected && total > Number(selected.amount) + 0.000001;
    return <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/45 p-3"><div className="grid gap-2"><Label htmlFor="purchase-source-request">Solicitud interna aprobada (opcional)</Label><SearchableSelect id="purchase-source-request" aria-label="Solicitud interna aprobada" value={value === null ? "" : String(value)} onValueChange={next => onChange(next ? Number(next) : null)} options={[{ value: "", label: "Sin autorización interna vinculada" }, ...budgets.map(budget => ({ value: String(budget.id), label: budget.description, description: `Solicitud #${budget.id} · máximo ${formatCurrency(Number(budget.amount))}` }))]} /></div>{selected ? <div className="text-sm"><p className="break-words font-medium">{selected.description}</p><p className={exceeds ? "mt-1 text-orange-700" : "mt-1 text-muted-foreground"}>Máximo autorizado: <strong>{formatCurrency(Number(selected.amount))}</strong>{exceeds ? " · El total supera la autorización." : " · Incluye los impuestos de la compra."}</p><p className="mt-2 text-xs text-muted-foreground">Se enviará a aprobación antes de registrar gasto y stock. Esta autorización solo puede vincularse a una propuesta de compra.</p></div> : <p className="text-xs text-muted-foreground">Vincula una autorización existente si esta compra procede de una solicitud del equipo.</p>}</section>;
}
