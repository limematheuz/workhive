"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CircleDollarSign, Loader2, PackagePlus, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { createClientId } from "@/lib/editable-line-key";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { InventoryService } from "@/services/inventory.service";
import type { InventoryMaterial, InventoryPurchase, InventoryPurchaseInput, InventorySupplier, InventoryWarehouse } from "@/types/inventory";

type PurchaseLineDraft = {
    id: string;
    materialId: string;
    warehouseId: string;
    quantity: string;
    unitCost: string;
    lotCode: string;
    lotExpiresAt: string;
};

type InventoryPurchasesSectionProps = {
    purchases: InventoryPurchase[];
    suppliers: InventorySupplier[];
    materials: InventoryMaterial[];
    warehouses: InventoryWarehouse[];
    loading: boolean;
    canManage: boolean;
    onChanged: () => Promise<void>;
};

const purchaseColumns: DataListColumn[] = [
    { key: "supplier", label: "Proveedor", className: "w-[24%]" },
    { key: "description", label: "Compra" },
    { key: "date", label: "Fecha", className: "w-32" },
    { key: "total", label: "Total", className: "w-28 text-right" },
    { key: "status", label: "Estado", className: "w-24 text-right" },
    { key: "actions", label: "Acciones", className: "w-32 text-right" },
];

function PurchaseStatus({ status }: { status: InventoryPurchase["status"] }) {
    return <Badge variant="outline" className={status === "received"
        ? "border-accent/25 bg-accent/10 text-accent"
        : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}>
        {status === "received" ? "Recibida" : "Corregida"}
    </Badge>;
}

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

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
}

function PurchaseDialog({
    open,
    onOpenChange,
    suppliers,
    materials,
    warehouses,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: InventorySupplier[];
    materials: InventoryMaterial[];
    warehouses: InventoryWarehouse[];
    onCreated: () => Promise<void>;
}) {
    const [purchaseDetails, setPurchaseDetails] = useState({
        supplierId: "",
        expenseDate: new Date().toISOString().slice(0, 10),
        description: "",
        paymentMethod: "",
        taxAmount: "0",
        reference: "",
        receiptUrl: "",
        notes: "",
    });
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
    const [lines, setLines] = useState<PurchaseLineDraft[]>([createLine()]);
    const [saving, setSaving] = useState(false);

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
    };

    const updateLine = (id: string, patch: Partial<PurchaseLineDraft>) => {
        setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!supplierId || !description.trim() || lines.some((line) => !line.materialId || !line.warehouseId || Number(line.quantity) <= 0 || Number(line.unitCost) < 0)) {
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
            await InventoryService.createPurchase(payload);
            toast.success("Compra, gasto y entrada de stock registrados.");
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
                    <DialogDescription>Genera un gasto con IVA y una entrada inmutable de stock por cada línea.</DialogDescription>
                </DialogHeader>
                <form className="grid max-h-[70vh] gap-5 overflow-y-auto py-2" onSubmit={(event) => void submit(event)}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2"><Label>Proveedor</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger aria-label="Proveedor de la compra"><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger><SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="inventory-purchase-date">Fecha fiscal</Label><DatePicker id="inventory-purchase-date" required value={expenseDate} onValueChange={setExpenseDate} /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-description">Concepto</Label><Input id="inventory-purchase-description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Reposición de consumibles" /></div>
                        <div className="grid gap-2"><Label>Forma de pago</Label><Select value={paymentMethod || "none"} onValueChange={(value) => setPaymentMethod(value === "none" ? "" : value)}><SelectTrigger aria-label="Forma de pago"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin especificar</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="bank_transfer">Transferencia</SelectItem><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="direct_debit">Domiciliación</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="inventory-purchase-tax">IVA soportado</Label><Input id="inventory-purchase-tax" type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-reference">Referencia</Label><Input id="inventory-purchase-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Factura, albarán o pedido opcional" /></div>
                        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="inventory-purchase-receipt">Justificante</Label><Input id="inventory-purchase-receipt" type="url" value={receiptUrl} onChange={(event) => setReceiptUrl(event.target.value)} placeholder="Enlace al justificante, si ya está disponible" /></div>
                    </div>
                    <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/55 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-main)]">Líneas recibidas</p><p className="text-xs text-[var(--text-muted)]">Cada línea crea una entrada en el almacén elegido.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createLine()])}><PackagePlus className="size-4" />Añadir línea</Button></div>
                        {lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/55 p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_7rem_auto]">
                            <Select value={line.materialId} onValueChange={(value) => updateLine(line.id, { materialId: value })}><SelectTrigger aria-label={`Material ${index + 1}`}><SelectValue placeholder="Material" /></SelectTrigger><SelectContent>{materials.map((material) => <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>)}</SelectContent></Select>
                            <Select value={line.warehouseId} onValueChange={(value) => updateLine(line.id, { warehouseId: value })}><SelectTrigger aria-label={`Almacén ${index + 1}`}><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
                            <Input type="number" min="0.001" step="0.001" aria-label={`Cantidad ${index + 1}`} placeholder="Cantidad" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} />
                            <Input type="number" min="0" step="0.0001" aria-label={`Coste unitario ${index + 1}`} placeholder="Coste/unidad" value={line.unitCost} onChange={(event) => updateLine(line.id, { unitCost: event.target.value })} />
                            {lines.length > 1 ? <Button type="button" variant="outline" size="sm" className="sm:col-span-2 lg:col-span-1" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Quitar</Button> : <span className="hidden lg:block" />}
                        </div><div className="grid gap-2 sm:grid-cols-2"><Input aria-label={`Lote ${index + 1}`} placeholder="Código de lote opcional" value={line.lotCode} onChange={(event) => updateLine(line.id, { lotCode: event.target.value, ...(event.target.value.trim() ? {} : { lotExpiresAt: "" }) })} /><DatePicker id={`inventory-purchase-lot-expiry-${line.id}`} aria-label={`Caducidad del lote ${index + 1}`} disabled={!line.lotCode.trim()} value={line.lotExpiresAt} onValueChange={(lotExpiresAt) => updateLine(line.id, { lotExpiresAt })} /></div></div>)}
                    </div>
                    <div className="grid gap-2"><Label htmlFor="inventory-purchase-notes">Notas</Label><Textarea id="inventory-purchase-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones internas opcionales" rows={2} /></div>
                    <div className="flex flex-wrap justify-end gap-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)]/55 px-4 py-3 text-sm"><span>Base: <strong>{formatCurrency(baseAmount)}</strong></span><span>IVA: <strong>{formatCurrency(Number(taxAmount || 0))}</strong></span><span>Total: <strong>{formatCurrency(totalAmount)}</strong></span></div>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="cancel">Cancelar</Button></DialogClose><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Registrar compra</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PurchaseCorrectionDialog({
    purchase,
    isSubmitting,
    onOpenChange,
    onConfirm,
}: {
    purchase: InventoryPurchase | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (purchase: InventoryPurchase, reason: string) => Promise<boolean>;
}) {
    const [reason, setReason] = useState("");

    const close = () => {
        setReason("");
        onOpenChange(false);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!purchase || !reason.trim()) return;
        if (await onConfirm(purchase, reason.trim())) close();
    };

    return (
        <Dialog open={purchase !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent compact>
                <DialogHeader>
                    <DialogTitle>Corregir compra</DialogTitle>
                    <DialogDescription>Generará un ajuste de salida y anulará el gasto asociado; el historial de la compra se conserva.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
                    <div className="grid gap-2">
                        <Label htmlFor="inventory-purchase-correction-reason">Motivo de la corrección</Label>
                        <Textarea id="inventory-purchase-correction-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe el motivo de la corrección" rows={3} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="cancel" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={!reason.trim() || isSubmitting}>{isSubmitting && <Loader2 className="size-4 animate-spin" />}Corregir compra</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function InventoryPurchasesSection({ purchases, suppliers, materials, warehouses, loading, canManage, onChanged }: InventoryPurchasesSectionProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [reversingId, setReversingId] = useState<number | null>(null);
    const [purchaseToCorrect, setPurchaseToCorrect] = useState<InventoryPurchase | null>(null);

    const reverse = async (purchase: InventoryPurchase, reason: string) => {
        setReversingId(purchase.id);
        try {
            await InventoryService.reversePurchase(purchase.id, reason);
            toast.success("Compra corregida mediante ajuste de stock.");
            await onChanged();
            return true;
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo corregir la compra."));
            return false;
        } finally {
            setReversingId(null);
        }
    };

    return <>
        <DataListTable
            items={purchases}
            getRowKey={(purchase) => purchase.id}
            columns={purchaseColumns}
            desktopFrom="lg"
            loading={loading}
            header={{ title: "Compras de material", subtitle: "Cada compra enlaza un gasto fiscal con entradas de stock inmutables.", countLabel: `${purchases.length} compras` }}
            toolbar={canManage ? <div className="flex justify-end"><Button type="button" disabled={suppliers.length === 0 || materials.length === 0 || warehouses.length === 0} onClick={() => setDialogOpen(true)}><CircleDollarSign className="size-4" />Nueva compra</Button></div> : undefined}
            empty={<p className="text-sm text-[var(--text-muted)]">Registra una compra cuando recibas material y su gasto asociado.</p>}
            renderDesktopRow={(purchase) => [
                <div key="supplier" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{purchase.supplier_name_snapshot}</p>{purchase.supplier_tax_id_snapshot && <p className="mt-1 text-xs text-[var(--text-muted)]">{purchase.supplier_tax_id_snapshot}</p>}</div>,
                <div key="description" className="min-w-0"><p className="truncate text-sm text-[var(--text-main)]">{purchase.expense.description}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{purchase.lines.length} {purchase.lines.length === 1 ? "línea" : "líneas"}{purchase.reference ? ` · ${purchase.reference}` : ""}</p></div>,
                <span key="date" className="text-sm text-[var(--text-muted)]">{formatDate(purchase.expense.expense_date)}</span>,
                <span key="total" className="block text-right text-sm font-semibold text-[var(--text-main)]">{formatCurrency(purchase.expense.total_amount)}</span>,
                <div key="status" className="flex justify-end"><PurchaseStatus status={purchase.status} /></div>,
                <div key="actions" className="flex justify-end">{canManage && purchase.status === "received" && <Button type="button" size="sm" variant="outline" disabled={reversingId === purchase.id} onClick={() => setPurchaseToCorrect(purchase)}>{reversingId === purchase.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Corregir</Button>}</div>,
            ]}
            renderCompactRow={(purchase) => <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{purchase.supplier_name_snapshot}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{purchase.expense.description} · {formatDate(purchase.expense.expense_date)}</p><div className="mt-2"><PurchaseStatus status={purchase.status} /></div></div><div className="flex shrink-0 flex-col items-end gap-2"><span className="font-semibold text-[var(--text-main)]">{formatCurrency(purchase.expense.total_amount)}</span>{canManage && purchase.status === "received" && <Button type="button" size="sm" variant="outline" disabled={reversingId === purchase.id} onClick={() => setPurchaseToCorrect(purchase)}><RotateCcw className="size-4" />Corregir</Button>}</div></div>}
        />
        <PurchaseDialog open={dialogOpen} onOpenChange={setDialogOpen} suppliers={suppliers} materials={materials} warehouses={warehouses} onCreated={onChanged} />
        <PurchaseCorrectionDialog purchase={purchaseToCorrect} isSubmitting={reversingId === purchaseToCorrect?.id} onOpenChange={(open) => !open && setPurchaseToCorrect(null)} onConfirm={reverse} />
    </>;
}
