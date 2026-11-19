"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { materialPlans, type MaterialPlan } from "@/services/material-plan.service";
import type { InventoryMaterial } from "@/types/inventory";
export function WorkOrderMaterialPlan({ order, materials, version, editable }: {
    order: number;
    materials: InventoryMaterial[];
    version: string;
    editable: boolean;
}) {
    const [rows, setRows] = useState<MaterialPlan[]>([]), [material, setMaterial] = useState(""), [quantity, setQuantity] = useState("");
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    useEffect(() => { let active = true; materialPlans(order).then(data => { if (active)
        setRows(data); }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [order, version]);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            setRows(await materialPlans(order, { material_id: Number(material), quantity }));
            setQuantity("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
        } finally {
            setBusy(false);
        }
    }
    return <section className="rounded-xl border p-4"><h3 className="font-semibold">Material previsto y utilizado</h3><p className="text-xs text-muted-foreground">Cantidades de esta orden en su centro. Los consumos y sus correcciones actualizan el utilizado.</p>
 {error && <p role="alert" className="text-orange-700">{error}</p>}
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Material</th><th>Previsto</th><th>Utilizado</th><th>Desviación</th></tr></thead><tbody>{rows.map(r => <tr key={r.material_id} className="border-b"><td className="py-2">{r.name} · {r.unit}</td><td className={r.planned === null ? "text-orange-700" : ""}>{r.planned ?? "Sin previsión"}</td><td>{r.used}</td><td className={r.planned === null || Number(r.used) > Number(r.planned) ? "text-orange-700" : ""}>{r.planned === null ? "Pendiente" : (Number(r.used) - Number(r.planned)).toFixed(3)}</td></tr>)}</tbody></table></div>
 {editable && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => void handleSubmit(event)}>
 <label className="text-xs">Material<FormSelect aria-label={"Material"} disabled={busy} required  value={material} onValueChange={selectedOptionValue=>setMaterial(selectedOptionValue)}><option value="">Seleccionar</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</FormSelect></label><label className="text-xs">Cantidad prevista<Input disabled={busy} required type="number" min="0" step=".001" value={quantity} onChange={e => setQuantity(e.target.value)}/></label><Button size="sm" disabled={busy}>Guardar previsión</Button></form>}
 </section>;
}
