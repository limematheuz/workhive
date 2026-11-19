import type { ComponentProps } from "react";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormInput, documentControlClassName } from "@/components/billing/DocumentFormControls";
import { FormSelect } from "@/components/ui/form-select";
import type { CurrencyFormState } from "@/lib/transaction-currency";
import type { CurrencyWorkspace } from "@/types/transaction-currency";

export type CurrencyFieldsProps = { form: CurrencyFormState; patch: (changes: Partial<CurrencyFormState>) => void; options: CurrencyWorkspace };
export function CurrencyInput({ label, hint, ...props }: ComponentProps<typeof DocumentFormInput> & { id: string; label: string; hint?: string }) {
    return <DocumentFormField id={props.id} label={label} hint={hint}><DocumentFormInput {...props} /></DocumentFormField>;
}
export function CurrencySelect({ id, label, value, onChange, items, placeholder = "Selecciona", disabled = false }: { id: string; label: string; value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }>; placeholder?: string; disabled?: boolean }) {
    return <DocumentFormField id={id} label={label}><FormSelect id={id} aria-label={label} value={value} onValueChange={onChange} disabled={disabled} className={documentControlClassName} searchable={["fx-client", "fx-settle-invoice", "fx-currency"].includes(id) || undefined}><option value="">{placeholder}</option>{items.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</FormSelect></DocumentFormField>;
}
export function CurrencyClientField({ form, patch, options }: CurrencyFieldsProps) {
    return <CurrencySelect id="fx-client" label="Cliente" value={form.clientId} onChange={clientId => patch({ clientId, invoiceId: "", settledAmount: "" })} items={options.clients.map(client => ({ value: String(client.id), label: client.name }))} placeholder="Selecciona el cliente" disabled={Boolean(form.original.service_contract_id || form.original.work_order_id)} />;
}
