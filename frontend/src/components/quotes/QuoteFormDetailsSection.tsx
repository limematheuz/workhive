"use client";
import {FormSelect} from "@/components/ui/form-select";

import {
    DocumentFormInput,
} from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { DatePicker } from "@/components/ui/date-picker";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Client } from "@/services/client.service";


type QuoteFormDetailsSectionProps = {
    dict: Dictionary;
    title: string;
    setTitle: (value: string) => void;
    selectedClientId: string;
    setSelectedClientId: (value: string) => void;
    clients: Client[];
    validUntil: string;
    setValidUntil: (value: string) => void;
};

export function QuoteFormDetailsSection({
    dict,
    title,
    setTitle,
    selectedClientId,
    setSelectedClientId,
    clients,
    validUntil,
    setValidUntil,
}: QuoteFormDetailsSectionProps) {
    return (
        <DocumentFormSection
            title="Datos del presupuesto"
            description="Define qué se ofrece, el cliente y hasta cuándo se mantiene la propuesta."
        >
            <div className="flex w-full min-w-0 flex-col gap-4">
                <DocumentFormField id="quote-title" label={dict.quotes?.title_label || "Título *"}>
                    <DocumentFormInput
                        id="quote-title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        maxLength={255}
                        placeholder={dict.quotes?.title_placeholder || "Ej: Limpieza de apartamento turístico"}
                    />
                </DocumentFormField>

                <div className="grid w-full min-w-0 grid-cols-1 gap-4 @[28rem]:grid-cols-2">
                    <DocumentFormField id="quote-client" label={dict.quotes?.client_label || "Cliente *"}>
                        <FormSelect searchable aria-label={dict.quotes?.client_label || "Cliente"} id="quote-client" className="h-11 w-full rounded-xl px-3 text-sm" placeholder={dict.quotes?.new_unregistered_client || "-- Nuevo Cliente / No registrado --"}
                            value={selectedClientId}
                            onValueChange={(value) => setSelectedClientId(value === "__new-client__" ? "" : value)}
                        >


                                <option value="__new-client__">
                                    {dict.quotes?.new_unregistered_client || "-- Nuevo Cliente / No registrado --"}
                                </option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id.toString()}>
                                        {client.name}
                                        {client.legal_number?.trim() ? ` (${client.legal_number.trim()})` : ""}
                                    </option>
                                ))}

                        </FormSelect>
                    </DocumentFormField>

                    <DocumentFormField
                        id="quote-valid-until"
                        label={dict.quotes?.valid_until_label || "Válido hasta"}
                    >
                        <DatePicker
                            id="quote-valid-until"
                            value={validUntil}
                            onValueChange={setValidUntil}
                            aria-label={dict.quotes?.valid_until_label || "Válido hasta"}
                        />
                    </DocumentFormField>
                </div>
            </div>
        </DocumentFormSection>
    );
}
