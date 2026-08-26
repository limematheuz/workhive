export interface BillingPartyFields {
    name: string;
    taxId: string;
    address: string;
    postalCode?: string;
    city?: string;
    province?: string;
    country?: string;
    phone: string;
    email: string;
    bank?: string;
    swiftBic?: string;
}

export type BillingPartyField = keyof BillingPartyFields;

const BILLING_LABELS: Record<Exclude<BillingPartyField, "name">, string> = {
    taxId: "NIF/CIF:",
    address: "Dirección:",
    postalCode: "CP:",
    city: "Ciudad:",
    province: "Provincia:",
    country: "País:",
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
        postalCode: "",
        city: "",
        province: "",
        country: "",
        phone: "",
        email: "",
        bank: "",
        swiftBic: "",
    };

    const unlabelledAddressLines: string[] = [];
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
        } else if (trimmedLine) {
            unlabelledAddressLines.push(trimmedLine);
        }
    }

    // Documents saved before the structured address fields used a second,
    // unlabelled line such as "17130 Girona, España". Keep those documents
    // editable without making the user retype their fiscal address.
    if (unlabelledAddressLines.length) {
        const legacyLocation = unlabelledAddressLines.pop() || "";
        const legacyMatch = legacyLocation.match(/^(\S+)\s+(.+?)(?:,\s*(.+))?$/);
        if (legacyMatch && !fields.postalCode && !fields.city) {
            fields.postalCode = legacyMatch[1];
            fields.city = legacyMatch[2];
            fields.country = legacyMatch[3] || "";
        } else {
            unlabelledAddressLines.push(legacyLocation);
        }
        if (unlabelledAddressLines.length) {
            fields.address = [fields.address, ...unlabelledAddressLines]
                .filter(Boolean)
                .join("\n");
        }
    }

    return fields;
}

export function formatBillingParty(fields: BillingPartyFields): string {
    const lines = [
        fields.name,
        `${BILLING_LABELS.taxId} ${fields.taxId}`,
        `${BILLING_LABELS.address} ${fields.address}`,
        `${BILLING_LABELS.postalCode} ${fields.postalCode || ""}`,
        `${BILLING_LABELS.city} ${fields.city || ""}`,
        `${BILLING_LABELS.province} ${fields.province || ""}`,
        `${BILLING_LABELS.country} ${fields.country || ""}`,
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
