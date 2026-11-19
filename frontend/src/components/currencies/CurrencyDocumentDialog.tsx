"use client";

import { useState, type FormEvent } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormTextarea } from "@/components/billing/DocumentFormControls";
import { DatePicker } from "@/components/ui/date-picker";
import { currencyForm, currencyKinds, currencyMoney, currencyPayload, type CurrencyFormState } from "@/lib/transaction-currency";
import { TransactionCurrencyService } from "@/services/transaction-currency.service";
import type { CurrencyKind, CurrencyRecord, CurrencyWorkspace } from "@/types/transaction-currency";
import { CurrencyClientField } from "./CurrencyFormFields";
import { CurrencyRateFields } from "./CurrencyRateFields";
import { CurrencyInvoiceFields } from "./CurrencyInvoiceFields";
import { CurrencyMovementFields, CurrencyPaymentMethod } from "./CurrencyMovementFields";

export function CurrencyDocumentDialog({ kind, record, options, close, saved }: { kind: CurrencyKind; record?: CurrencyRecord | null; options: CurrencyWorkspace; close: () => void; saved: (record: CurrencyRecord) => void }) {
    const [form, setForm] = useState(() => currencyForm(kind, record));
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    const patch = (changes: Partial<CurrencyFormState>) => setForm(current => ({ ...current, ...changes }));
    const fields = { form, patch, options };
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError("");
        try {
            const payload = currencyPayload(kind, form, options);
            setSaving(true);
            const result = await TransactionCurrencyService.save(kind, payload, record?.id);
            toast.success(kind === "invoices" ? "Borrador guardado con su moneda original y equivalencia en EUR." : "Operación guardada con el cambio verificado.");
            saved(result);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la operación."); }
        finally { setSaving(false); }
    };
    const sidebar = <div className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4"><h3 className="text-sm font-semibold">Resumen de la operación</h3><dl className="space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Documento</dt><dd>{currencyKinds[kind]}{kind === "invoices" ? " · borrador" : ""}</dd></div><div><dt className="text-xs text-muted-foreground">Moneda original</dt><dd className={form.currency ? "font-semibold" : "text-orange-700"}>{form.currency || "Pendiente de seleccionar"}</dd></div><div><dt className="text-xs text-muted-foreground">Equivalencia declarada</dt><dd>1 {form.currency || "unidad"} = {form.rate || "—"} EUR</dd><dd className="text-xs text-muted-foreground">Fecha: {form.rateDate || "Pendiente"}</dd></div></dl><p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Introduce todos los precios e importes en la moneda original, sin separadores de miles. Los importes contables en EUR se calculan y guardan juntos al confirmar.</p>{record && <p className="text-xs text-muted-foreground">Último importe guardado: {currencyMoney(record.currency_snapshot.original_amounts.total_amount, record.currency_snapshot.currency)} · {currencyMoney(record.amount_eur)}.</p>}<p className={form.verified ? "text-xs text-emerald-700" : "text-xs text-orange-700"}>{form.verified ? "Cambio comprobado y confirmado." : "Pendiente: verificar el cambio antes de guardar."}</p></div>;
    return <DocumentFormDialog open onOpenChange={open => { if (!open && !saving) close(); }} onSubmit={event => void submit(event)} icon={<Coins className="size-5" />} title={`${record ? "Editar" : "Nueva operación"} · ${currencyKinds[kind]}`} description="Conserva el documento en su moneda original y registra su equivalencia contable en EUR con un cambio manual comprobado." sidebar={sidebar} cancelLabel="Cancelar" submitLabel={kind === "invoices" ? "Guardar borrador" : "Guardar operación"} submittingLabel="Guardando…" submitting={saving} submitDisabled={saving || !form.verified} onCancel={() => { if (!saving) close(); }}>
        {error && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-800 dark:text-orange-300">{error}</p>}
        <DocumentFormSection title="Documento y fecha" description="Usa la fecha real del documento o del cobro. El cambio no puede ser posterior a esta fecha."><div className="grid gap-4 sm:grid-cols-2"><DocumentFormField id="fx-operation-date" label="Fecha de la operación"><DatePicker id="fx-operation-date" value={form.date} required onValueChange={date => patch({ date, verified: false })} /></DocumentFormField>{kind !== "sales" && <CurrencyClientField {...fields} />}</div></DocumentFormSection>
        <CurrencyRateFields {...fields} />
        {kind === "invoices" ? <CurrencyInvoiceFields {...fields} /> : <CurrencyMovementFields {...fields} kind={kind} />}
        {kind !== "sales" && <DocumentFormSection title="Pago y notas" description="Las notas internas se conservan en la ficha de empresa."><CurrencyPaymentMethod {...fields} /><div className="mt-4"><DocumentFormField id="fx-notes" label="Notas internas"><DocumentFormTextarea id="fx-notes" value={form.notes} maxLength={kind === "expenses" ? 500 : 10000} onChange={e => patch({ notes: e.target.value })} /></DocumentFormField></div>{kind === "invoices" && <div className="mt-4"><DocumentFormField id="fx-terms" label="Condiciones del documento"><DocumentFormTextarea id="fx-terms" value={form.terms} onChange={e => patch({ terms: e.target.value })} /></DocumentFormField></div>}</DocumentFormSection>}
    </DocumentFormDialog>;
}
