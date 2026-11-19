"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useUser } from "@/lib/user-context";
import { approvalRequest, type PurchaseProposal } from "@/services/workflow-approval.service";
import { formatCurrency } from "@/lib/format";
import { purchaseTotalCents } from "@/lib/inventory-purchase-flow";
import type { InventoryMaterial, InventorySupplier, InventoryWarehouse } from "@/types/inventory";

const total = (row: PurchaseProposal) => formatCurrency(Number(purchaseTotalCents(row.purchase)) / 100);
const statuses = { pending: "Pendiente de aprobación", approved: "Aprobada", rejected: "Rechazada" };
const columns: DataListColumn[] = [{ key: "purchase", label: "Propuesta" }, { key: "supplier", label: "Proveedor" }, { key: "total", label: "Total" }, { key: "status", label: "Estado" }];
const unitCost = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });
function renderProposalStatus(row: PurchaseProposal) {
    return <span className={row.status === "pending" ? "text-orange-700" : "text-muted-foreground"}>{statuses[row.status]}{row.purchase_id ? ` · compra #${row.purchase_id}` : ""}</span>;
}

export function PurchaseApprovalPanel({ revision, changed, canManage, suppliers, materials, warehouses, focusId }: { revision: number; changed: () => void; canManage: boolean; suppliers: InventorySupplier[]; materials: InventoryMaterial[]; warehouses: InventoryWarehouse[]; focusId?: number | null }) {
    const { user } = useUser();
    const [selected, setSelected] = useState<PurchaseProposal | null>(null), [note, setNote] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
    const [result, setResult] = useState<{ key: string; rows: PurchaseProposal[] } | null>(null);
    const key = `${user?.company_id}:${user?.id}:${revision}:${refresh}`;
    const request = useCallback(() => approvalRequest<PurchaseProposal[]>("purchases"), []);
    useResourceEffect(Boolean(user), key, request, rows => { setResult({ key, rows }); setError(""); }, cause => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las propuestas."));
    const rows = result?.key === key ? result.rows : [];
    const supplierName = (row: PurchaseProposal) => suppliers.find(item => item.id === row.purchase.supplier_id)?.name ?? `Proveedor archivado (ref. ${row.purchase.supplier_id})`;
    async function decide(decision: "approved" | "rejected") {
        if (!selected || !canManage) return;
        setBusy(true); setError("");
        try { await approvalRequest(`purchases/${selected.id}/decision`, { decision, note: note.trim(), fingerprint: selected.fingerprint }); setSelected(null); setNote(""); setRefresh(value => value + 1); changed(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo revisar la compra."); }
        finally { setBusy(false); }
    }
    return <section className="mt-4 space-y-3 rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Propuestas de compra</h3><p className="mt-1 text-xs text-muted-foreground">Aprobar registra las líneas revisadas, su gasto y las entradas de almacén en una sola operación.</p></div><Button size="icon" variant="outline" aria-label="Actualizar propuestas de compra" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-4" /></Button></div>
        {error && <p role="alert" className="text-sm text-orange-700">{error}</p>}
        <DataListTable variant="plain" columns={columns} items={rows} getRowKey={row => row.id} loading={!result && !error} header={{ title: "Compras enviadas a revisión", countLabel: `${rows.length} propuestas`, subtitle: "Hasta 200 propuestas recientes de la empresa." }} empty={<p className="p-3 text-sm text-muted-foreground">No hay propuestas de compra registradas.</p>} onRowClick={row => { setSelected(row); setNote(""); setError(""); }} rowAriaLabel={row => `${canManage && row.status === "pending" ? "Revisar" : "Ver"} compra ${row.purchase.description}`} renderDesktopRow={row => [<div key="purchase"><strong className="text-sm">{row.purchase.description}</strong><p className="mt-1 text-xs text-muted-foreground">Propuesta #{row.id}{row.id === focusId ? " · Seleccionada desde solicitudes" : ""}</p></div>, <span key="supplier" className="text-sm">{supplierName(row)}</span>, <span key="total" className="text-sm font-semibold">{total(row)}</span>, <span key="status" className="text-xs">{renderProposalStatus(row)}</span>]} renderCompactRow={row => <div className="space-y-2"><div className="flex justify-between gap-3"><strong>{row.purchase.description}</strong><span className="shrink-0 font-semibold">{total(row)}</span></div><p className="text-xs text-muted-foreground">{supplierName(row)} · propuesta #{row.id}</p><p className="text-xs">{renderProposalStatus(row)}</p></div>} />
        <AlertDialog open={selected !== null} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><AlertDialogContent className="max-h-[85vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>{canManage && selected?.status === "pending" ? "Revisar solicitud de compra" : "Detalle de la propuesta"}</AlertDialogTitle><AlertDialogDescription>{canManage && selected?.status === "pending" ? "Comprueba proveedor, importe y materiales. La aprobación registrará el gasto y la recepción de stock." : "Contenido presentado para revisión y estado de la compra."}</AlertDialogDescription></AlertDialogHeader>
            {selected && <div className="space-y-4 text-sm"><div><strong>{selected.purchase.description} · {total(selected)}</strong><p className="mt-1 text-muted-foreground">{supplierName(selected)} · {selected.purchase.expense_date.slice(0, 10)}</p><p className="mt-1">{renderProposalStatus(selected)}</p></div>
                {selected.source_request && <div className="rounded-xl border border-accent/30 bg-accent/5 p-3"><p className="font-medium">Autorización interna #{selected.source_request.id}</p><p className="mt-1 break-words">{selected.source_request.description}</p><p className="mt-1 text-xs">Máximo autorizado con impuestos: {formatCurrency(Number(selected.source_request.amount))}</p></div>}
                <ul className="divide-y border-y">{selected.purchase.lines.map(line => <li key={`${line.material_id}:${line.warehouse_id}:${line.lot_code ?? ""}`} className="py-3"><p className="font-medium">{materials.find(item => item.id === line.material_id)?.name ?? `Material archivado (ref. ${line.material_id})`}</p><p className="mt-1 text-xs text-muted-foreground">{warehouses.find(item => item.id === line.warehouse_id)?.name ?? `Almacén archivado (ref. ${line.warehouse_id})`} · {line.quantity} × {unitCost.format(Number(line.unit_cost))}{line.lot_code ? ` · Lote ${line.lot_code}` : ""}</p></li>)}</ul>
                <p>IVA soportado: {formatCurrency(Number(selected.purchase.tax_amount))}</p>{selected.purchase.reference && <p>Referencia: {selected.purchase.reference}</p>}{selected.purchase.notes && <p className="whitespace-pre-wrap text-muted-foreground">{selected.purchase.notes}</p>}{selected.note && <p className="rounded-lg bg-muted p-3">Decisión: {selected.note}</p>}
                {selected.purchase_id && <Button variant="outline" size="sm" asChild><Link href={`/dashboard/inventory?tab=purchases&purchase_id=${selected.purchase_id}`} onClick={() => setSelected(null)}>Ver compra registrada #{selected.purchase_id}</Link></Button>}
                {canManage && selected.status === "pending" && <Input value={note} maxLength={2000} aria-label="Motivo de la decisión de compra" placeholder="Observaciones; obligatorias para rechazar" onChange={event => setNote(event.target.value)} />}
            </div>}
            {error && <p role="alert" className="text-sm text-orange-700">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>{canManage && selected?.status === "pending" && <><AlertDialogAction disabled={busy || !note.trim()} onClick={event => { event.preventDefault(); void decide("rejected"); }}>Rechazar</AlertDialogAction><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void decide("approved"); }}>Aprobar y registrar</AlertDialogAction></>}</AlertDialogFooter>
        </AlertDialogContent></AlertDialog>
    </section>;
}
