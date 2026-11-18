"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import type { WorkOrder } from "@/types/work-order";
import type { InventorySupplier } from "@/types/inventory";
import { subcontractRequest, type Subcontract } from "@/services/subcontract.service";
export function SubcontractForm({ item, orders, suppliers, saved }: {
    item: Subcontract | null;
    orders: WorkOrder[];
    suppliers: InventorySupplier[];
    saved: () => void;
}) {
    const [draft, setDraft] = useState({ order: item?.work_order_id.toString() ?? "", supplier: item?.supplier_id.toString() ?? "", amount: item?.amount ?? "", description: item?.description ?? "", document: item?.document_url ?? "", expiry: item?.document_expires_on ?? "" });
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    return <form className="rounded-xl border p-4" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
                await subcontractRequest(item ? "/" + item.id : "", { work_order_id: Number(draft.order), supplier_id: Number(draft.supplier), amount: draft.amount, description: draft.description, document_url: draft.document || null, document_expires_on: draft.expiry || null }, item ? "PUT" : "POST");
                saved();
            }
            catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo guardar.");
            }
            finally {
                setBusy(false);
            }
        }}>
 <h2 className="mb-3 font-semibold">{item ? "Editar subcontrata" : "Nueva subcontrata"}</h2><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3">
 <label className="text-sm">Orden de trabajo<FormSelect aria-label={"Orden de trabajo"}  required value={draft.order} onValueChange={selectedOptionValue=>setDraft({ ...draft, order: selectedOptionValue })}><option value="">Seleccionar</option>{orders.filter(o => o.status !== "cancelled").map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</FormSelect></label>
 <label className="text-sm">Empresa proveedora<FormSelect aria-label={"Empresa proveedora"}  required value={draft.supplier} onValueChange={selectedOptionValue=>setDraft({ ...draft, supplier: selectedOptionValue })}><option value="">Seleccionar</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</FormSelect></label>
 <label className="text-sm">Coste acordado sin impuestos (€)<Input required type="number" min="0" step=".01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })}/></label>
 <label className="text-sm sm:col-span-3">Servicio encargado<Input required maxLength={255} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
 <label className="text-sm sm:col-span-2">Enlace a documentación del proveedor<Input type="url" placeholder="https://…" value={draft.document} onChange={e => setDraft({ ...draft, document: e.target.value })}/></label><label className="text-sm">Documentación válida hasta<DatePicker aria-label="Caducidad de la documentación del proveedor" value={draft.expiry} onValueChange={v => setDraft({ ...draft, expiry: v })}/></label><Button className="justify-self-start">Guardar subcontrata</Button></fieldset>
 {error && <p role="alert" className="mt-2 text-orange-700">{error}</p>}</form>;
}
