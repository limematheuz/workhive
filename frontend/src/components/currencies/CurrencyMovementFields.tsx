import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/components/expenses/expense-options";
import { useDictionary } from "@/lib/dictionary-context";
import { currencyMoney } from "@/lib/transaction-currency";
import type { CurrencyKind } from "@/types/transaction-currency";
import { CurrencyInput, CurrencySelect, type CurrencyFieldsProps } from "./CurrencyFormFields";

export function CurrencyPaymentMethod({ form, patch }: CurrencyFieldsProps) {
    const { dict } = useDictionary();
    return <CurrencySelect id="fx-payment-method" label="Forma de pago" value={form.method} onChange={method => patch({ method })} items={PAYMENT_METHOD_OPTIONS.map(value => ({ value, label: dict.expenses.payment_methods[value as keyof typeof dict.expenses.payment_methods] || value }))} />;
}
export function CurrencyMovementFields({ kind, ...props }: CurrencyFieldsProps & { kind: CurrencyKind }) {
    const { form, patch, options } = props;
    const { dict } = useDictionary();
    if (kind === "payments") {
        const invoices = options.invoices.filter(invoice => String(invoice.client_id) === form.clientId);
        return <DocumentFormSection title="Importe recibido y aplicación" description="Registra el dinero recibido en su moneda original. La aplicación a una factura y la diferencia de cambio se contabilizan en la misma operación."><div className="grid gap-4 sm:grid-cols-2"><CurrencyInput id="fx-amount" label={`Importe recibido ${form.currency}`} inputMode="decimal" required value={form.amount} onChange={e => patch({ amount: e.target.value })} /><CurrencyInput id="fx-reference" label="Referencia" maxLength={160} value={form.reference} onChange={e => patch({ reference: e.target.value })} /></div>
            <div className="mt-4"><CurrencySelect id="fx-settle-invoice" label="Aplicar a una factura (opcional)" value={form.invoiceId} onChange={invoiceId => patch({ invoiceId, settledAmount: "" })} placeholder={form.clientId ? "Dejar cobro sin aplicar" : "Selecciona primero un cliente"} disabled={!form.clientId} items={invoices.map(invoice => ({ value: String(invoice.id), label: `${invoice.number} · saldo ${currencyMoney(invoice.outstanding_eur)}${invoice.currency_snapshot ? ` · original ${invoice.currency_snapshot.currency}` : ""}` }))} /></div>
            {form.invoiceId && <div className="mt-4"><CurrencyInput id="fx-settled-amount" label={`Parte del cobro aplicada (${form.currency})`} required inputMode="decimal" value={form.settledAmount} onChange={e => patch({ settledAmount: e.target.value })} hint="Puede ser menor que el importe recibido. En facturas de la misma moneda se conserva su valoración contable y se registra la ganancia o pérdida por cambio." /></div>}
        </DocumentFormSection>;
    }
    if (kind === "invoices") return null;
    return <DocumentFormSection title={kind === "expenses" ? "Datos del gasto" : "Venta histórica"} description={kind === "expenses" ? "Indica la base y los impuestos exactos del justificante en la moneda original." : "Registra una venta anterior sin emitir una nueva factura. Se conserva su importe original y la equivalencia en EUR."}>
        {kind === "expenses" ? <><div className="grid gap-4 sm:grid-cols-2"><CurrencyInput id="fx-vendor" label="Proveedor" maxLength={160} value={form.vendor} onChange={e => patch({ vendor: e.target.value })} /><CurrencySelect id="fx-category" label="Categoría" value={form.category} onChange={category => patch({ category })} items={CATEGORY_OPTIONS.map(value => ({ value, label: dict.expenses.categories[value as keyof typeof dict.expenses.categories] || value }))} /></div><div className="mt-4"><CurrencyInput id="fx-description" label="Concepto" required maxLength={255} value={form.description} onChange={e => patch({ description: e.target.value })} /></div></> : <><div className="grid gap-4 sm:grid-cols-2"><CurrencyInput id="fx-sale-number" label="Número del documento" required maxLength={50} value={form.number} onChange={e => patch({ number: e.target.value })} /><CurrencyInput id="fx-sale-client" label="Nombre del cliente" required maxLength={160} value={form.clientName} onChange={e => patch({ clientName: e.target.value })} /></div><div className="mt-4"><CurrencySelect id="fx-sale-status" label="Estado de cobro" value={form.paymentStatus} onChange={paymentStatus => patch({ paymentStatus })} items={[{ value: "pending", label: "Pendiente" }, { value: "paid", label: "Pagada" }]} /></div></>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><CurrencyInput id="fx-base" label={`Base imponible ${form.currency}`} required inputMode="decimal" value={form.base} onChange={e => patch({ base: e.target.value })} /><CurrencyInput id="fx-tax" label={`Impuestos ${form.currency}`} required inputMode="decimal" value={form.tax} onChange={e => patch({ tax: e.target.value })} /></div>
        {Boolean(form.original.service_contract_id || form.original.work_order_id) && <p className="mt-3 text-xs text-muted-foreground">Se conserva la asignación operativa al contrato o trabajo del gasto original. La ficha de gastos permite revisar su justificante y sus datos complementarios.</p>}
    </DocumentFormSection>;
}
