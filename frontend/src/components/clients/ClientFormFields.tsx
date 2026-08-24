"use client";

import { Building2, Handshake, MapPin, UserRound } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDictionary } from "@/lib/dictionary-context";
import type { Client } from "@/services/client.service";

type ClientFormFieldsProps = {
    client?: Client | null;
    clientType: Client["client_type"];
    onClientTypeChange: (type: Client["client_type"]) => void;
    isActive?: boolean;
    onActiveChange?: (active: boolean) => void;
    idPrefix: string;
};

const inputClassName = "bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)]";

export function ClientFormFields({ client, clientType, onClientTypeChange, isActive, onActiveChange, idPrefix }: ClientFormFieldsProps) {
    const { dict } = useDictionary();
    const form = dict.clients.form;
    const types = [
        { id: "individual" as const, label: dict.clients.table.individual, icon: UserRound },
        { id: "business" as const, label: dict.clients.table.company, icon: Building2 },
        { id: "company" as const, label: dict.clients.table.collaborator, icon: Handshake },
    ];

    return <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">{form.name_label}</h3>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {types.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onClientTypeChange(id)} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ui-motion ${clientType === id ? "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]" : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.6fr)]">
                <Field id={`${idPrefix}-name`} name="name" label={form.name_label} placeholder={form.name_placeholder} defaultValue={client?.name} required />
                <Field id={`${idPrefix}-legal`} name="legal_number" label={form.legal_number_label} placeholder={form.legal_number_placeholder} defaultValue={client?.legal_number} />
            </div>
            {onActiveChange && <label className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm font-medium text-[var(--text-main)]"><Checkbox checked={isActive} onCheckedChange={(checked) => onActiveChange(checked === true)} />{isActive ? dict.clients.table.active : dict.clients.table.inactive}</label>}
        </section>

        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">{dict.clients.details.email}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id={`${idPrefix}-email`} name="email" label={form.email_label} placeholder={form.email_placeholder} defaultValue={client?.email} type="email" />
                <Field id={`${idPrefix}-phone`} name="phone" label={form.phone_label} placeholder={form.phone_placeholder} defaultValue={client?.phone} />
            </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/45 p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><MapPin className="h-4 w-4 text-accent" />{form.address_label}</h3>
            <div className="mt-4 grid gap-4">
                <Field id={`${idPrefix}-address`} name="address" label={form.address_label} placeholder={form.address_placeholder} defaultValue={client?.address} required />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field id={`${idPrefix}-city`} name="city" label={form.city_label} placeholder={form.city_placeholder} defaultValue={client?.city} required />
                    <Field id={`${idPrefix}-province`} name="province" label={form.province_label} placeholder={form.province_placeholder} defaultValue={client?.province} />
                    <Field id={`${idPrefix}-postal`} name="postal_code" label={form.postal_code_label} placeholder={form.postal_code_placeholder} defaultValue={client?.postal_code} required />
                    <Field id={`${idPrefix}-country`} name="country" label={form.country_label} placeholder={form.country_placeholder} defaultValue={client?.country} required />
                </div>
            </div>
        </section>
    </div>;
}

function Field({ id, name, label, placeholder, defaultValue, required = false, type = "text" }: { id: string; name: string; label: string; placeholder: string; defaultValue?: string | null; required?: boolean; type?: string }) {
    return <div className="space-y-1.5"><Label htmlFor={id}>{label}{required && <span className="ml-1 text-[var(--btn-cancel-text)]">*</span>}</Label><Input id={id} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue ?? ""} required={required} className={inputClassName} /></div>;
}
