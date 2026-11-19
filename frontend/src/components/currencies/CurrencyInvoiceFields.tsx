import { Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DatePicker } from "@/components/ui/date-picker";
import { newNativeLine } from "@/lib/transaction-currency";
import { CurrencyInput, type CurrencyFieldsProps } from "./CurrencyFormFields";

export function CurrencyInvoiceFields({ form, patch }: CurrencyFieldsProps) {
    return <><div className="grid gap-4 sm:grid-cols-2"><CurrencyInput id="fx-invoice-number" label="Número de factura (opcional)" value={form.number} maxLength={50} onChange={e => patch({ number: e.target.value })} hint="Se asigna automáticamente si lo dejas vacío." /><DocumentFormField id="fx-due-date" label="Vencimiento (opcional)"><DatePicker id="fx-due-date" value={form.dueDate} onValueChange={dueDate => patch({ dueDate })} /></DocumentFormField></div>
        <DocumentFormSection title="Conceptos en moneda original" description={`Precios en ${form.currency || "la moneda seleccionada"}. El servidor calcula los totales originales y su equivalencia contable en EUR al guardar.`}>
            <div className="space-y-3">{form.lines.map((line, index) => {
                const update = (changes: Partial<typeof line>) => patch({ lines: form.lines.map(item => item.key === line.key ? { ...item, ...changes } : item) });
                return <div key={line.key} className="rounded-xl border border-[var(--border-soft)] p-3"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold">Concepto {index + 1}</p><Button type="button" variant="ghost" size="icon" disabled={form.lines.length === 1} aria-label={`Eliminar concepto ${index + 1}`} onClick={() => patch({ lines: form.lines.filter(item => item.key !== line.key) })}><Trash2 className="size-4" /></Button></div>
                    <CurrencyInput id={`fx-line-description-${line.key}`} label="Descripción" required maxLength={500} value={line.description} onChange={e => update({ description: e.target.value })} />
                    <div className="mt-3 grid gap-3 sm:grid-cols-3"><CurrencyInput id={`fx-line-quantity-${line.key}`} label="Cantidad" inputMode="decimal" required value={line.quantity} onChange={e => update({ quantity: e.target.value })} /><CurrencyInput id={`fx-line-price-${line.key}`} label={`Precio / unidad ${form.currency}`} inputMode="decimal" required value={line.unitPrice} onChange={e => update({ unitPrice: e.target.value })} /><CurrencyInput id={`fx-line-tax-${line.key}`} label="IVA (%)" inputMode="decimal" required value={line.taxPercent} onChange={e => update({ taxPercent: e.target.value })} /></div>
                    {Boolean(line.original.task_item_id) && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Link2 className="size-3" />Trabajo vinculado #{String(line.original.task_item_id)}. Su precio acordado se comprueba al guardar.</p>}</div>;
            })}</div><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => patch({ lines: [...form.lines, newNativeLine()] })}><Plus className="size-4" />Añadir concepto</Button>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><CurrencyInput id="fx-discount" label="Descuento (%)" inputMode="decimal" value={form.discount} onChange={e => patch({ discount: e.target.value })} /><CurrencyInput id="fx-surcharge" label="Recargo (%)" inputMode="decimal" value={form.surcharge} onChange={e => patch({ surcharge: e.target.value })} /><CurrencyInput id="fx-retention" label="Retención (%)" inputMode="decimal" value={form.retention} onChange={e => patch({ retention: e.target.value })} /></div>
        </DocumentFormSection></>;
}
