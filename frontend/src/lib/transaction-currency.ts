import type { CurrencyKind, CurrencyPayload, CurrencyRecord, CurrencyWorkspace } from "../types/transaction-currency.ts";
import { createClientId } from "./editable-line-key.ts";

export const currencyKinds: Record<CurrencyKind, string> = { invoices: "Factura", expenses: "Gasto", payments: "Cobro", sales: "Venta histórica" };
export const currencyStatuses: Record<string, string> = { draft: "Borrador", issued: "Emitida", overdue: "Vencida", paid: "Pagada", partially_paid: "Pago parcial", received: "Recibido", voided: "Anulado", active: "Activo", deleted: "Eliminado", cancelled: "Cancelada", rectified: "Rectificada", pending: "Pendiente" };
const formatters = new Map<string, Intl.NumberFormat>();
export function currencyMoney(amount: string | number | null | undefined, currency = "EUR", unitPrice = false) {
    const number = Number(amount);
    if (amount == null || !Number.isFinite(number)) return "—";
    const key = currency + (unitPrice ? ":unit" : "");
    let formatter = formatters.get(key);
    if (!formatter) { formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency, currencyDisplay: "code", ...(unitPrice ? { maximumFractionDigits: 8 } : {}) }); formatters.set(key, formatter); }
    return formatter.format(number);
}
export function currencyDecimal(value: string, label: string, precision = 6, positive = false, maximum = 9999999999.99): string {
    let normalized = value.trim().replace(",", ".");
    if (normalized.startsWith(".")) normalized = "0" + normalized;
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${label}: usa un número sin separadores de miles.`);
    const [integer, fraction = ""] = normalized.split(".");
    const decimals = fraction.replace(/0+$/, "");
    if (decimals.length > precision) throw new Error(`${label}: admite hasta ${precision} decimales.`);
    normalized = (integer.replace(/^0+(?=\d)/, "") || "0") + (decimals ? "." + decimals : "");
    const number = Number(normalized);
    if (!Number.isFinite(number) || number > maximum || (positive && number <= 0)) throw new Error(`${label}: indica un importe válido${positive ? " mayor que cero" : ""}.`);
    return normalized;
}
export function currencyToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
export type NativeLineForm = { key: string; description: string; quantity: string; unitPrice: string; taxPercent: string; original: Record<string, unknown> };
export type CurrencyFormState = {
    currency: string; rate: string; rateDate: string; verified: boolean; date: string; dueDate: string;
    clientId: string; number: string; description: string; vendor: string; category: string;
    base: string; tax: string; amount: string; method: string; reference: string; notes: string;
    clientName: string; paymentStatus: string; discount: string; surcharge: string; retention: string; terms: string;
    invoiceId: string; settledAmount: string; lines: NativeLineForm[]; original: Record<string, unknown>;
};
const text = (value: unknown) => value == null ? "" : String(value);
const percent = (value: unknown) => Number.isFinite(Number(value)) ? String(Number((Number(value) * 100).toFixed(8))) : "21";
export function newNativeLine(): NativeLineForm { return { key: createClientId(), description: "", quantity: "1", unitPrice: "", taxPercent: "21", original: {} }; }
export function currencyForm(kind: CurrencyKind, record?: CurrencyRecord | null): CurrencyFormState {
    const snapshot = record?.currency_snapshot, doc = record?.edit_document ?? snapshot?.original_document ?? {};
    const at = doc[kind === "invoices" ? "issue_date" : kind === "expenses" ? "expense_date" : kind === "payments" ? "received_at" : "entry_date"];
    const items = Array.isArray(doc.items) ? doc.items as Record<string, unknown>[] : [];
    return { original: doc, currency: snapshot?.currency ?? "", rate: snapshot?.eur_rate ?? "", rateDate: snapshot?.rate_date ?? currencyToday(), verified: false,
        date: text(at).slice(0, 10) || currencyToday(), dueDate: text(doc.due_date).slice(0, 10), clientId: text(doc.client_id), number: text(doc.invoice_number ?? doc.document_number),
        description: text(doc.description), vendor: text(doc.vendor), category: text(doc.category) || "operations", base: text(doc.base_amount), tax: text(doc.tax_amount) || "0", amount: text(doc.amount),
        method: text(doc.payment_method) || "bank_transfer", reference: text(doc.reference), notes: text(doc.notes), clientName: text(doc.client_name), paymentStatus: text(doc.payment_status) || "pending",
        discount: text(doc.discount) || "0", surcharge: text(doc.equivalence_surcharge) || "0", retention: text(doc.retention) || "0", terms: text(doc.terms), invoiceId: "", settledAmount: "",
        lines: items.length ? items.map(item => ({ key: createClientId(), description: text(item.description), quantity: text(item.quantity), unitPrice: text(item.unit_price), taxPercent: percent(item.tax_rate), original: item })) : [newNativeLine()] };
}
function isIsoDay(day: string) { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day; }
function operationDate(day: string, original: unknown) {
    if (!isIsoDay(day)) throw new Error("Indica una fecha de operación válida.");
    return typeof original === "string" && original.slice(0, 10) === day ? original : `${day}T12:00:00Z`;
}
export function currencyPayload(kind: CurrencyKind, form: CurrencyFormState, options: Pick<CurrencyWorkspace, "currencies" | "minor_units">): CurrencyPayload {
    if (!options.currencies.includes(form.currency)) throw new Error("Selecciona la moneda original de la operación.");
    if (!form.verified) throw new Error("Confirma que has comprobado el tipo de cambio y su fecha.");
    const rate = currencyDecimal(form.rate, "Tipo de cambio", 8, true, 100000000);
    if (form.currency === "EUR" && Number(rate) !== 1) throw new Error("El cambio de EUR debe ser 1.");
    const at = operationDate(form.date, form.original.issue_date ?? form.original.expense_date ?? form.original.received_at);
    if (!isIsoDay(form.rateDate) || form.rateDate < "2000-01-01" || form.rateDate > form.date || form.rateDate > currencyToday()) throw new Error("La fecha del cambio debe ser real y no posterior a la operación.");
    const minor = options.minor_units[form.currency] ?? 2;
    const amount = (value: string, label: string, positive = false) => currencyDecimal(value, label, minor, positive);
    const clientId = Number(form.clientId);
    if ((kind === "invoices" || kind === "payments") && (!Number.isInteger(clientId) || clientId <= 0)) throw new Error("Selecciona el cliente.");
    let document: Record<string, unknown>;
    if (kind === "invoices") {
        if (!form.lines.length) throw new Error("Añade al menos un concepto a la factura.");
        document = { ...form.original, client_id: clientId, issue_date: at, due_date: form.dueDate ? operationDate(form.dueDate, form.original.due_date) : null,
            invoice_number: form.number.trim() || null, payment_method: form.method, notes: form.notes || null, terms: form.terms || null,
            discount: currencyDecimal(form.discount, "Descuento", 4, false, 100), equivalence_surcharge: currencyDecimal(form.surcharge, "Recargo", 4, false, 100), retention: currencyDecimal(form.retention, "Retención", 4, false, 100),
            items: form.lines.map(line => { if (!line.description.trim()) throw new Error("Completa la descripción de cada concepto."); return { ...line.original, description: line.description.trim(), quantity: currencyDecimal(line.quantity, "Cantidad", 6, true), unit_price: currencyDecimal(line.unitPrice, "Precio unitario", 8), tax_rate: Number(currencyDecimal(line.taxPercent, "IVA", 6, false, 100)) / 100 }; }) };
    } else if (kind === "expenses") {
        if (!form.description.trim()) throw new Error("Indica el concepto del gasto.");
        document = { ...form.original, expense_date: at, client_id: clientId || null, vendor: form.vendor.trim() || null, description: form.description.trim(), category: form.category, payment_method: form.method, base_amount: amount(form.base, "Base"), tax_amount: amount(form.tax, "Impuestos"), notes: form.notes || null };
    } else if (kind === "sales") {
        if (!form.number.trim() || !form.clientName.trim()) throw new Error("Indica el número del documento y el nombre del cliente.");
        document = { ...form.original, entry_date: form.date, document_number: form.number.trim(), client_name: form.clientName.trim(), payment_status: form.paymentStatus, base_amount: amount(form.base, "Base"), tax_amount: amount(form.tax, "Impuestos") };
    } else {
        document = { ...form.original, received_at: at, client_id: clientId, amount: amount(form.amount, "Importe recibido", true), payment_method: form.method, reference: form.reference || null, notes: form.notes || null, allocations: [] };
    }
    const payload: CurrencyPayload = { currency: form.currency, eur_rate: rate, rate_date: form.rateDate, rate_verified: true, document };
    if (kind === "payments" && form.invoiceId) {
        payload.settle_invoice_id = Number(form.invoiceId); payload.settled_native_amount = amount(form.settledAmount, "Importe original aplicado", true);
        if (Number(payload.settled_native_amount) > Number(document.amount)) throw new Error("El importe aplicado no puede superar el cobro recibido.");
    }
    return payload;
}
