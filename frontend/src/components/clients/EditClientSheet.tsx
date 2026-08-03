"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Client, ClientService } from "@/services/client.service"
import { toast } from "@/lib/toast"
import { useDictionary } from "@/lib/dictionary-context"
import { Building2, UserRound } from "lucide-react"

interface EditClientSheetProps {
    client: Client | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onClientUpdated?: () => void
}

export function EditClientSheet({
    client,
    open,
    onOpenChange,
    onClientUpdated,
}: EditClientSheetProps) {
    const { dict } = useDictionary()
    const [isLoading, setIsLoading] = React.useState(false)
    const [clientTypeOverride, setClientTypeOverride] = React.useState<"individual" | "business" | null>(null)
    const clientType = clientTypeOverride || client?.client_type || "individual"

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!client) return
        setIsLoading(true)

        try {
            const formData = new FormData(e.currentTarget)
            await ClientService.updateClient(client.id, {
                name: formData.get("name") as string,
                client_type: clientType,
                email: (formData.get("email") as string).trim() || null,
                phone: (formData.get("phone") as string).trim() || null,
                address: formData.get("address") as string,
                city: formData.get("city") as string,
                province: formData.get("province") as string,
                postal_code: formData.get("postal_code") as string,
                country: formData.get("country") as string,
                legal_number: (formData.get("legal_number") as string).trim() || null,
            })

            toast.success(dict.clients.form.update_success_toast)
            setClientTypeOverride(null)
            onOpenChange(false)
            if (onClientUpdated) {
                onClientUpdated()
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : dict.clients.form.update_error_toast)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) setClientTypeOverride(null)
                onOpenChange(nextOpen)
            }}
        >
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle>{dict.clients.form.edit_title}</DialogTitle>
                        <DialogDescription>
                            {dict.clients.form.edit_description}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-1">
                            {([
                                { id: "individual", label: "Particular", icon: UserRound },
                                { id: "business", label: "Empresa", icon: Building2 },
                            ] as const).map((option) => {
                                const Icon = option.icon
                                const active = clientType === option.id
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setClientTypeOverride(option.id)}
                                        className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                                            active
                                                ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm"
                                                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {option.label}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-[var(--text-main)]">
                                {dict.clients.form.name_label}
                            </Label>
                            <Input
                                id="edit-name"
                                name="name"
                                defaultValue={client?.name}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-province" className="text-[var(--text-main)]">
                                {dict.clients.form.province_label}
                            </Label>
                            <Input
                                id="edit-province"
                                name="province"
                                defaultValue={client?.province || ""}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-legal_number" className="text-[var(--text-main)]">
                                {dict.clients.form.legal_number_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input
                                id="edit-legal_number"
                                name="legal_number"
                                defaultValue={client?.legal_number || ""}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-email" className="text-[var(--text-main)]">
                                {dict.clients.form.email_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                defaultValue={client?.email || ""}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-phone" className="text-[var(--text-main)]">
                                {dict.clients.form.phone_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input
                                id="edit-phone"
                                name="phone"
                                defaultValue={client?.phone || ""}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-address" className="text-[var(--text-main)]">
                                {dict.clients.form.address_label}
                            </Label>
                            <Input
                                id="edit-address"
                                name="address"
                                defaultValue={client?.address}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-city" className="text-[var(--text-main)]">
                                    {dict.clients.form.city_label}
                                </Label>
                                <Input
                                    id="edit-city"
                                    name="city"
                                    defaultValue={client?.city}
                                    required
                                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-postal_code" className="text-[var(--text-main)]">
                                    {dict.clients.form.postal_code_label}
                                </Label>
                                <Input
                                    id="edit-postal_code"
                                    name="postal_code"
                                    defaultValue={client?.postal_code}
                                    required
                                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-country" className="text-[var(--text-main)]">
                                {dict.clients.form.country_label}
                            </Label>
                            <Input
                                id="edit-country"
                                name="country"
                                defaultValue={client?.country}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>
                    </div>

                    <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setClientTypeOverride(null)
                                onOpenChange(false)
                            }}
                            className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                        >
                            {dict.clients.form.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer ui-motion"
                        >
                            {isLoading ? dict.clients.form.saving : dict.clients.form.save}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
