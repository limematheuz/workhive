import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { currencyToday } from "@/lib/transaction-currency";
import { CurrencyInput, CurrencySelect, type CurrencyFieldsProps } from "./CurrencyFormFields";

export function CurrencyRateFields({ form, patch, options }: CurrencyFieldsProps) {
    const maxDate = [currencyToday(), form.date].filter(Boolean).sort()[0];
    return <DocumentFormSection title="Moneda y cambio verificado" description="Introduce el cambio utilizado en la operación. 1 unidad de la moneda original equivale al número de euros indicado.">
        <div className="grid gap-4 sm:grid-cols-2"><CurrencySelect id="fx-currency" label="Moneda original" value={form.currency} onChange={currency => patch({ currency, rate: currency === "EUR" ? "1" : "", verified: false })} items={options.currencies.map(value => ({ value, label: value }))} />
            <CurrencyInput id="fx-rate" label={`1 ${form.currency || "unidad"} = … EUR`} value={form.rate} inputMode="decimal" required readOnly={form.currency === "EUR"} onChange={e => patch({ rate: e.target.value, verified: false })} hint="Hasta 8 decimales. Sin separadores de miles." />
            <DocumentFormField id="fx-rate-date" label="Fecha del cambio"><DatePicker id="fx-rate-date" value={form.rateDate} required min="2000-01-01" max={maxDate} onValueChange={rateDate => patch({ rateDate, verified: false })} /></DocumentFormField>
        </div>
        {form.currency && <p className="mt-3 text-xs text-muted-foreground">Los importes de {form.currency} admiten {options.minor_units[form.currency] ?? 2} decimales. Los precios unitarios de factura pueden llevar mayor precisión.</p>}
        <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3 ${form.verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-orange-500/30 bg-orange-500/5"}`}><Checkbox id="fx-rate-verified" checked={form.verified} onCheckedChange={value => patch({ verified: value === true })} /><Label htmlFor="fx-rate-verified" className="text-sm leading-5">He comprobado la moneda, el tipo de cambio y su fecha con el documento o justificante de la operación.</Label></div>
    </DocumentFormSection>;
}
