export interface BillingPartyFields {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    bank?: string;
    swiftBic?: string;
}

export type BillingPartyField = keyof BillingPartyFields;

const BILLING_LABELS: Record<Exclude<BillingPartyField, "name">, string> = {
    taxId: "NIF/CIF:",
    address: "Dirección:",
    phone: "Teléfono:",
    email: "Email:",
    bank: "Banco:",
    swiftBic: "SWIFT/BIC:",
};

export function parseBillingParty(info: string): BillingPartyFields {
    const [name = "", ...lines] = info.split("\n");
    const fields: BillingPartyFields = {
        name,
        taxId: "",
        address: "",
        phone: "",
        email: "",
        bank: "",
        swiftBic: "",
    };

    for (const line of lines) {
        const trimmedLine = line.trim();
        const matchingField = Object.entries(BILLING_LABELS).find(([, label]) =>
            trimmedLine.startsWith(label)
        );

        if (matchingField) {
            const [field, label] = matchingField as [
                Exclude<BillingPartyField, "name">,
                string,
            ];
            fields[field] = trimmedLine.slice(label.length).trim();
        } else if (!fields.address && trimmedLine) {
            fields.address = trimmedLine;
        }
    }

    return fields;
}

export function formatBillingParty(fields: BillingPartyFields): string {
    const lines = [
        fields.name,
        `${BILLING_LABELS.taxId} ${fields.taxId}`,
        `${BILLING_LABELS.address} ${fields.address}`,
        `${BILLING_LABELS.phone} ${fields.phone}`,
        `${BILLING_LABELS.email} ${fields.email}`,
    ];

    if (fields.bank) {
        lines.push(`${BILLING_LABELS.bank} ${fields.bank}`);
    }
    if (fields.swiftBic) {
        lines.push(`${BILLING_LABELS.swiftBic} ${fields.swiftBic}`);
    }

    return lines.join("\n");
}

export function updateBillingPartyField(
    fields: BillingPartyFields,
    field: BillingPartyField,
    value: string
): BillingPartyFields {
    return { ...fields, [field]: value };
}
