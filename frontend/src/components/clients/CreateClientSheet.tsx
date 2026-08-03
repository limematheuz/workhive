"use client"

import * as React from "react"
import { Building2, Plus, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { ClientService } from "@/services/client.service"
import { useDictionary } from "@/lib/dictionary-context"

interface CreateClientSheetProps {
    onClientCreated?: () => void
}

export function CreateClientSheet({ onClientCreated }: CreateClientSheetProps) {
    const { dict } = useDictionary()
    const [open, setOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [clientType, setClientType] = React.useState<"individual" | "business">("individual")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        
        try {
            const formData = new FormData(e.currentTarget)
            await ClientService.createClient({
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
            
            toast.success(dict.clients.form.success_toast)
            setOpen(false)
            if (onClientCreated) {
                onClientCreated()
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : dict.clients.form.error_toast)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold rounded-xl px-5 py-2.5 text-xs border border-[var(--border-soft)] shadow-sm w-full md:w-auto ui-motion cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    {dict.clients.form.new_client}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-[var(--border-soft)] flex-shrink-0">
                        <DialogTitle>{dict.clients.form.create_title}</DialogTitle>
                        <DialogDescription>
                            {dict.clients.form.create_description}
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
                                        onClick={() => setClientType(option.id)}
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
                            <Label htmlFor="name" className="text-[var(--text-main)]">{dict.clients.form.name_label}</Label>
                            <Input 
                                id="name"
                                name="name"
                                placeholder={dict.clients.form.name_placeholder}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="legal_number" className="text-[var(--text-main)]">
                                {dict.clients.form.legal_number_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input 
                                id="legal_number" 
                                name="legal_number"
                                placeholder={dict.clients.form.legal_number_placeholder}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="province" className="text-[var(--text-main)]">{dict.clients.form.province_label}</Label>
                            <Input
                                id="province"
                                name="province"
                                placeholder={dict.clients.form.province_placeholder}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[var(--text-main)]">
                                {dict.clients.form.email_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input 
                                id="email" 
                                name="email" 
                                type="email"
                                placeholder={dict.clients.form.email_placeholder}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>
 
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-[var(--text-main)]">
                                {dict.clients.form.phone_label} <span className="text-[var(--text-muted)]">(opcional)</span>
                            </Label>
                            <Input 
                                id="phone" 
                                name="phone"
                                placeholder={dict.clients.form.phone_placeholder}
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>
 
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-[var(--text-main)]">{dict.clients.form.address_label}</Label>
                            <Input 
                                id="address" 
                                name="address"
                                placeholder={dict.clients.form.address_placeholder}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>
 
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city" className="text-[var(--text-main)]">{dict.clients.form.city_label}</Label>
                                <Input 
                                    id="city" 
                                    name="city"
                                    placeholder={dict.clients.form.city_placeholder}
                                    required
                                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="postal_code" className="text-[var(--text-main)]">{dict.clients.form.postal_code_label}</Label>
                                <Input 
                                    id="postal_code" 
                                    name="postal_code"
                                    placeholder={dict.clients.form.postal_code_placeholder}
                                    required
                                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                                />
                            </div>
                        </div>
 
                        <div className="space-y-2">
                            <Label htmlFor="country" className="text-[var(--text-main)]">{dict.clients.form.country_label}</Label>
                            <Input 
                                id="country" 
                                name="country"
                                placeholder={dict.clients.form.country_placeholder}
                                required
                                className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)]" 
                            />
                        </div>
                    </div>
 
                    <div className="dialog-glass-chrome p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] flex-shrink-0">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setOpen(false)}
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
