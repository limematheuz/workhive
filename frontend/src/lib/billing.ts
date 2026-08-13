export interface BillingPartyFields {
    name: string
    taxId: string
    address: string
    phone: string
    email: string
    bank?: string
    swiftBic?: string
}

export function parseBillingInfo(infoStr: string): BillingPartyFields {
    const lines = infoStr.split("\n")
    const name = lines[0] || ""

    let taxId = ""
    let address = ""
    let phone = ""
    let email = ""
    let bank = ""
    let swiftBic = ""

    lines.slice(1).forEach((line) => {
        if (line.startsWith("NIF/CIF:")) taxId = line.replace("NIF/CIF:", "").trim()
        else if (line.startsWith("Dirección:")) address = line.replace("Dirección:", "").trim()
        else if (line.startsWith("Teléfono:")) phone = line.replace("Teléfono:", "").trim()
        else if (line.startsWith("Email:")) email = line.replace("Email:", "").trim()
        else if (line.startsWith("Banco:")) bank = line.replace("Banco:", "").trim()
        else if (line.startsWith("SWIFT/BIC:")) swiftBic = line.replace("SWIFT/BIC:", "").trim()
        else if (address === "" && line.trim() !== "") {
            address = line.trim()
        }
    })

    return { name, taxId, address, phone, email, bank, swiftBic }
}
