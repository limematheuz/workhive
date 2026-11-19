"use client";
import { useMemo, useState, type FormEvent } from "react";
import { Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { createClientId } from "@/lib/editable-line-key";
import { formatCurrency } from "@/lib/format";
import { preparePurchaseSubmission } from "@/lib/inventory-purchase-flow";
import { toast } from "@/lib/toast";
import { InventoryService } from "@/services/inventory.service";
import { submitPurchaseProposal, type ApprovalPolicy, type ApprovedPurchaseBudget } from "@/services/workflow-approval.service";
import type { InventoryMaterial, InventoryPurchaseInput, InventorySupplier, InventoryWarehouse } from "@/types/inventory";
import { PurchaseBudgetSelector } from "./PurchaseBudgetSelector";

type PurchaseLineDraft = {
    id: string;
    materialId: string;
    warehouseId: string;
    quantity: string;
    unitCost: string;
    lotCode: string;
    lotExpiresAt: string;
};

function createLine(): PurchaseLineDraft {
    return {
        id: createClientId(),
        materialId: "",
        warehouseId: "",
        quantity: "",
        unitCost: "",
        lotCode: "",
        lotExpiresAt: "",
    };
}

export function InventoryPurchaseDialog({
    open,
    onOpenChange,
    suppliers,
    materials,
    warehouses,
    onCreated,
    policy,
    canRecord,
    budgets,
    initialSource,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: InventorySupplier[];
    materials: InventoryMaterial[];
    warehouses: InventoryWarehouse[];
    onCreated: () => Promise<void>;
    policy: ApprovalPolicy;
    canRecord: boolean;
    budgets: ApprovedPurchaseBudget[];
    initialSource?: ApprovedPurchaseBudget | null;
}) {
    const [purchaseDetails, setPurchaseDetails] = useState(() => ({
        supplierId: "",
        expenseDate: new Date().toISOString().slice(0, 10),
        description: initialSource?.description.slice(0, 255) ?? "",
        paymentMethod: "",
        taxAmount: "0",
        reference: "",
        receiptUrl: "",
        notes: "",
    }));
    const { supplierId, expenseDate, description, paymentMethod, taxAmount, reference, receiptUrl, notes } = purchaseDetails;
    const updatePurchaseDetails = (patch: Partial<typeof purchaseDetails>) => setPurchaseDetails((current) => ({ ...current, ...patch }));
    const setSupplierId = (supplierId: string) => updatePurchaseDetails({ supplierId });
    const setExpenseDate = (expenseDate: string) => updatePurchaseDetails({ expenseDate });
    const setDescription = (description: string) => updatePurchaseDetails({ description });
    const setPaymentMethod = (paymentMethod: string) => updatePurchaseDetails({ paymentMethod });
    const setTaxAmount = (taxAmount: string) => updatePurchaseDetails({ taxAmount });
    const setReference = (reference: string) => updatePurchaseDetails({ reference });
    const setReceiptUrl = (receiptUrl: string) => updatePurchaseDetails({ receiptUrl });
    const setNotes = (notes: string) => updatePurchaseDetails({ notes });
    const [lines, setLines] = useState<PurchaseLineDraft[]>(() => [createLine()]);
    const [saving, setSaving] = useState(false);
    const [sourceId, setSourceId] = useState<number | null>(initialSource?.id ?? null);
    const requiresApproval = policy.purchases_required || sourceId !== null || !canRecord;

    const baseAmount = useMemo(
        () => lines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitCost || 0), 0),
        [lines],
    );
    const totalAmount = baseAmount + Number(taxAmount || 0);

    const reset = () => {
        setSupplierId("");
        setExpenseDate(new Date().toISOString().slice(0, 10));
        setDescription("");
        setPaymentMethod("");
        setTaxAmount("0");
        setReference("");
        setReceiptUrl("");
        setNotes("");
        setLines([createLine()]);
        setSourceId(null);
    };

    const updateLine = (id: string, patch: Partial<PurchaseLineDraft>) => {
        setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!supplierId || !description.trim() || lines.some((line) => !line.materialId || !line.warehouseId || !line.quantity.trim() || !line.unitCost.trim() || Number(line.quantity) <= 0 || Number(line.unitCost) < 0)) {
            toast.error("Completa proveedor, concepto y cada línea de material.");
            return;
        }
        const payload: InventoryPurchaseInput = {
            supplier_id: Number(supplierId),
            expense_date: `${expenseDate}T12:00:00`,
            category: "supplies",
            description: description.trim(),
            payment_method: paymentMethod || null,
            tax_amount: taxAmount || "0",
            receipt_url: receiptUrl.trim() || null,
            reference: reference.trim() || null,
            notes: notes.trim() || null,
            lines: lines.map((line) => ({
                material_id: Number(line.materialId),
                warehouse_id: Number(line.warehouseId),
                quantity: line.quantity,
                unit_cost: line.unitCost,
                lot_code: line.lotCode.trim() || null,
                lot_expires_at: line.lotExpiresAt || null,
            })),
        };
        setSaving(true);
        try {
            const intent = preparePurchaseSubmission(policy, payload, sourceId, budgets, canRecord);
            if(intent.approvalRequired){await submitPurchaseProposal(payload, intent.sourceId);toast.success("Solicitud de compra enviada. Pendiente de revisión antes de registrar el gasto y el stock.");}
            else{await InventoryService.createPurchase(payload);toast.success("Compra, gasto y entrada de stock registrados.");}
            reset();
            onOpenChange(false);
            await onCreated();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo registrar la compra."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) reset(); }}>
            <DialogContent compact className="max-w-4xl" confirmDiscard>
                <DialogHeader>
                    <DialogTitle>Nueva compra de material</DialogTitle>
                    <DialogDescription>{requiresApproval ? "Prepara la compra para revisar. El gasto y las entradas de stock se registrarán al aprobarla." : "Genera un gasto con IVA y una entrada inmutable de stock por cada línea."}</DialogDescription>
                </DialogHeader>
                <form className="grid max-h-[70vh] gap-5 overflow-y-auto py-2" onSubmit={(event) => void submit(event)}>
                    {policy.available && <PurchaseBudgetSelector budgets={budgets} value={sourceId} total={totalAmount} onChange={id => { setSourceId(id); const source = budgets.find(item => item.id === id); if (source) setDescription(source.description.slice(0, 255)); }} />}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2"><Label>Proveedor</Label><SearchableSelect aria-label="Proveedor de la compra" required value={supplierId} onValueChange={setSupplierId} placeholder="Selecciona proveedor" options={suppliers.map(supplier => ({ value: String(supplier.id), label: supplier.name, description: supplier.tax_id ?? undefined }))} /></div>
                        <div className="grid gap-2"><Label htmlFor="inventory-purchase-date">Fecha fiscal</Label><DatePicker id="inventory-purchase-date" required value={expenseDate} onValueChange={setExpenseDate} /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-description">Concepto</Label><Input id="inventory-purchase-description" maxLength={255} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Reposición de consumibles" /></div>
                        <div className="grid gap-2"><Label>Forma de pago</Label><Select value={paymentMethod || "none"} onValueChange={(value) => setPaymentMethod(value === "none" ? "" : value)}><SelectTrigger aria-label="Forma de pago"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin especificar</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="bank_transfer">Transferencia</SelectItem><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="direct_debit">Domiciliación</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="inventory-purchase-tax">IVA soportado</Label><Input id="inventory-purchase-tax" type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-reference">Referencia</Label><Input id="inventory-purchase-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Factura, albarán o pedido opcional" /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-receipt">Justificante</Label><Input id="inventory-purchase-receipt" type="url" value={receiptUrl} onChange={(event) => setReceiptUrl(event.target.value)} placeholder="Enlace al justificante, si ya está disponible" /></div>
                    </div>
                    <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/55 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-main)]">Líneas recibidas</p><p className="text-xs text-[var(--text-muted)]">Cada línea crea una entrada en el almacén elegido.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createLine()])}><PackagePlus className="size-4" />Añadir línea</Button></div>
                        {lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/55 p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_7rem_auto]">
                            <SearchableSelect aria-label={`Material ${index + 1}`} required value={line.materialId} onValueChange={value => updateLine(line.id, { materialId: value })} placeholder="Buscar material" options={materials.map(material => ({ value: String(material.id), label: material.name, description: material.sku }))} />
                            <SearchableSelect aria-label={`Almacén ${index + 1}`} required value={line.warehouseId} onValueChange={value => updateLine(line.id, { warehouseId: value })} placeholder="Buscar almacén" options={warehouses.map(warehouse => ({ value: String(warehouse.id), label: warehouse.name, description: warehouse.address ?? undefined }))} />
                            <Input type="number" min="0.001" step="0.001" aria-label={`Cantidad ${index + 1}`} placeholder="Cantidad" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} />
                            <Input type="number" min="0" step="0.0001" aria-label={`Coste unitario ${index + 1}`} placeholder="Coste/unidad" value={line.unitCost} onChange={(event) => updateLine(line.id, { unitCost: event.target.value })} />
                            {lines.length > 1 ? <Button type="button" variant="outline" size="sm" className="sm:col-span-2 lg:col-span-1" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Quitar</Button> : <span className="hidden lg:block" />}
                        </div><div className="grid gap-2 sm:grid-cols-2"><Input aria-label={`Lote ${index + 1}`} placeholder="Código de lote opcional" value={line.lotCode} onChange={(event) => updateLine(line.id, { lotCode: event.target.value, ...(event.target.value.trim() ? {} : { lotExpiresAt: "" }) })} /><DatePicker id={`inventory-purchase-lot-expiry-${line.id}`} aria-label={`Caducidad del lote ${index + 1}`} disabled={!line.lotCode.trim()} value={line.lotExpiresAt} onValueChange={(lotExpiresAt) => updateLine(line.id, { lotExpiresAt })} /></div></div>)}
                    </div>
                    <div className="grid gap-2"><Label htmlFor="inventory-purchase-notes">Notas</Label><Textarea id="inventory-purchase-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones internas opcionales" rows={2} /></div>
                    <div className="flex flex-wrap justify-end gap-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/55 px-4 py-3 text-sm"><span>Base: <strong>{formatCurrency(baseAmount)}</strong></span><span>IVA: <strong>{formatCurrency(Number(taxAmount || 0))}</strong></span><span>Total: <strong>{formatCurrency(totalAmount)}</strong></span></div>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="cancel">Cancelar</Button></DialogClose><Button type="submit" disabled={saving || (requiresApproval && !policy.available)}>{saving && <Loader2 className="size-4 animate-spin" />}{requiresApproval?"Enviar a aprobación":"Registrar compra"}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
