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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
                        <Select
                            value={client.client_type}
                            onValueChange={(value) => update(
                                "client_type",
                                value as QuoteClientRegistrationInput["client_type"],
                            )}
                        >
                            <SelectTrigger id="quote-client-type" className="h-10 w-full rounded-xl px-3 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="individual">Particular</SelectItem>
                                <SelectItem value="business">Empresa</SelectItem>
                            </SelectContent>
                        </Select>
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
                        <Button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            variant="cancel"
                            className="cursor-pointer hover:translate-y-0 hover:shadow-none"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={loading}
                            onClick={onAcceptOnly}
                            variant="outline"
                            className="cursor-pointer hover:translate-y-0 hover:shadow-none"
                        >
                            Aceptar sin registrar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer hover:translate-y-0 hover:shadow-none"
                        >
                            Registrar y aceptar
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
