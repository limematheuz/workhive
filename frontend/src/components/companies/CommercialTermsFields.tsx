import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CommercialTermsFormValue } from "@/lib/commercial-terms";

type CommercialTermsFieldsProps = {
    idPrefix: string;
    value: CommercialTermsFormValue;
    onChange: (value: CommercialTermsFormValue) => void;
};

export function CommercialTermsFields({ idPrefix, value, onChange }: CommercialTermsFieldsProps) {
    return (
        <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 p-3">
            <div>
                <h3 className="text-sm font-semibold text-[var(--text-main)]">Condiciones comerciales</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Se guardan como un snapshot inmutable del acuerdo. El importe se indica sin IVA.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`${idPrefix}-interval`}>Facturación</Label>
                    <Select value={value.billing_interval} onValueChange={(billing_interval) => onChange({ ...value, billing_interval: billing_interval as CommercialTermsFormValue["billing_interval"] })}>
                        <SelectTrigger id={`${idPrefix}-interval`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="monthly">Mensual</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`${idPrefix}-amount`}>Importe sin IVA</Label>
                    <Input id={`${idPrefix}-amount`} required inputMode="decimal" min="0" placeholder="29,00" type="text" value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value })} />
                </div>
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`${idPrefix}-currency`}>Moneda</Label>
                    <Select value={value.currency} onValueChange={(currency) => onChange({ ...value, currency })}>
                        <SelectTrigger id={`${idPrefix}-currency`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`${idPrefix}-tax`}>IVA</Label>
                    <Select value={value.tax_behavior} onValueChange={(tax_behavior) => onChange({ ...value, tax_behavior: tax_behavior as CommercialTermsFormValue["tax_behavior"] })}>
                        <SelectTrigger id={`${idPrefix}-tax`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="exclusive">No incluido</SelectItem><SelectItem value="inclusive">Incluido</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-0 space-y-1.5 sm:max-w-sm">
                    <Label htmlFor={`${idPrefix}-effective-at`}>Fecha efectiva</Label>
                    <DatePicker id={`${idPrefix}-effective-at`} required value={value.effective_at} onValueChange={(effective_at) => onChange({ ...value, effective_at })} />
                </div>
            </div>
        </section>
    );
}
