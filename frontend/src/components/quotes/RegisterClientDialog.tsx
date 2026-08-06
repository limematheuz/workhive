"use client"

import * as React from "react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { QuoteClientRegistrationInput } from "@/lib/quote-client-registration"

interface RegisterClientDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    loading: boolean
    initialClient: QuoteClientRegistrationInput
    onAcceptOnly: () => void
    onRegisterAndAccept: (client: QuoteClientRegistrationInput) => void
}

export function RegisterClientDialog({
    open,
    ...props
}: RegisterClientDialogProps) {
    if (!open) return null

    return <OpenRegisterClientDialog open {...props} />
}

function OpenRegisterClientDialog({
    open,
    onOpenChange,
    loading,
    initialClient,
    onAcceptOnly,
    onRegisterAndAccept,
}: RegisterClientDialogProps) {
    const [client, setClient] = React.useState(() => initialClient)

    const update = <K extends keyof QuoteClientRegistrationInput>(
        field: K,
        value: QuoteClientRegistrationInput[K],
    ) => setClient((current) => ({ ...current, [field]: value }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl border-[var(--border-soft)]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-black text-[var(--text-main)]">
                        ¿Registrar cliente nuevo?
                    </DialogTitle>
                </DialogHeader>
                <p className="pt-2 text-sm text-[var(--text-muted)]">
                    Confirma los datos esenciales. La aceptación y el alta se guardarán juntas.
                </p>
                <form
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        onRegisterAndAccept(client)
                    }}
                >
                    <div className="sm:col-span-2 space-y-1">
                        <Label htmlFor="quote-client-name">Nombre *</Label>
                        <Input id="quote-client-name" required maxLength={100} value={client.name} onChange={(event) => update("name", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-type">Tipo *</Label>
                        <select
                            id="quote-client-type"
                            value={client.client_type}
                            onChange={(event) => update(
                                "client_type",
                                event.target.value as QuoteClientRegistrationInput["client_type"],
                            )}
                            className="h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-main)]"
                        >
                            <option value="individual">Particular</option>
                            <option value="business">Empresa</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-tax-id">NIF/CIF</Label>
                        <Input id="quote-client-tax-id" maxLength={20} value={client.legal_number || ""} onChange={(event) => update("legal_number", event.target.value || null)} />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                        <Label htmlFor="quote-client-address">Dirección fiscal *</Label>
                        <Input id="quote-client-address" required maxLength={255} value={client.address} onChange={(event) => update("address", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-city">Ciudad *</Label>
                        <Input id="quote-client-city" required maxLength={100} value={client.city} onChange={(event) => update("city", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-postal-code">Código postal *</Label>
                        <Input id="quote-client-postal-code" required maxLength={10} value={client.postal_code} onChange={(event) => update("postal_code", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-province">Provincia</Label>
                        <Input id="quote-client-province" maxLength={100} value={client.province || ""} onChange={(event) => update("province", event.target.value || null)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-country">País *</Label>
                        <Input id="quote-client-country" required maxLength={100} value={client.country} onChange={(event) => update("country", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-email">Email</Label>
                        <Input id="quote-client-email" type="email" value={client.email || ""} onChange={(event) => update("email", event.target.value || null)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="quote-client-phone">Teléfono</Label>
                        <Input id="quote-client-phone" maxLength={20} value={client.phone || ""} onChange={(event) => update("phone", event.target.value || null)} />
                    </div>
                    <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="px-4 py-2 text-xs font-semibold bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] rounded-xl ui-motion cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onAcceptOnly}
                            className="px-4 py-2 text-xs font-semibold bg-[var(--bg-tertiary)] text-[var(--text-main)] border border-[var(--border-soft)] rounded-xl ui-motion cursor-pointer"
                        >
                            Aceptar sin registrar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] rounded-xl ui-motion cursor-pointer"
                        >
                            Registrar y aceptar
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
