"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/lib/toast"
import { QuoteService, type QuoteUpdate } from "@/services/quote.service"
import { formatQuoteNumber } from "@/lib/format"
import { QUOTE_STATUS_BADGE } from "@/lib/constants"
import { parseBillingInfo } from "@/lib/billing"
import { printQuote } from "@/lib/quote-print"
import { Quote } from "@/types/quote"
import { useDictionary } from "@/lib/dictionary-context"
import { ClientService, Client } from "@/services/client.service"
import { RegisterClientDialog } from "./RegisterClientDialog"
import { QuoteDetailMeta } from "./QuoteDetailMeta"
import { QuoteDetailItems } from "./QuoteDetailItems"
import { QuoteDetailNotes } from "./QuoteDetailNotes"
import { QuoteDetailActions } from "./QuoteDetailActions"
import { getErrorMessage } from "@/lib/errors"

interface QuoteDetailSheetProps {
    quote: Quote | null
    open: boolean
    onOpenChange: (open: boolean) => void
    clients: Client[]
    onQuoteUpdated: () => void
    companyName?: string
    companyLogo?: string | null
}

export function QuoteDetailSheet({
    quote,
    open,
    onOpenChange,
    clients,
    onQuoteUpdated,
    companyName,
    companyLogo,
}: QuoteDetailSheetProps) {
    const { dict } = useDictionary()
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [showRegisterClientPrompt, setShowRegisterClientPrompt] = React.useState(false)

    if (!quote) return null

    const getClientName = (id: number | null) => {
        if (id === null) {
            if (quote.custom_recipient_info) {
                return quote.custom_recipient_info.split("\n")[0]
            }
            return dict.quotes?.unregistered_client || "No registrado / Nuevo"
        }
        return clients.find((c) => c.id === id)?.name ?? `Cliente #${id}`
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: dict.quotes?.status_draft ?? "Borrador",
            sent: dict.quotes?.status_sent ?? "Enviado",
            accepted: dict.quotes?.status_accepted ?? "Aceptado",
            rejected: dict.quotes?.status_rejected ?? "Rechazado",
            expired: dict.quotes?.status_expired ?? "Vencido",
        }
        return labels[status] ?? status
    }

    const updateStatus = async (newStatus: string, registerClient: boolean = false) => {
        setLoading(true)
        try {
            const updatedFields: QuoteUpdate = { status: newStatus }

            if (newStatus === "accepted" && quote.client_id === null && registerClient) {
                const parsed = parseBillingInfo(quote.custom_recipient_info || "")
                const newClient = await ClientService.createClient({
                    name: parsed.name || quote.title || "Nuevo Cliente",
                    client_type: "individual",
                    legal_number: parsed.taxId || "",
                    address: parsed.address || "",
                    phone: parsed.phone || "",
                    email: parsed.email || "",
                    city: "",
                    postal_code: "",
                    country: "",
                })
                updatedFields.client_id = newClient.id
                toast.success(`Cliente "${newClient.name}" registrado en la base de datos`)
            }

            await QuoteService.updateQuote(quote.id, updatedFields)
            toast.success(dict.quotes?.status_updated ?? "Estado actualizado")
            onQuoteUpdated()
            onOpenChange(false)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Error al actualizar el presupuesto"))
        } finally {
            setLoading(false)
            setShowRegisterClientPrompt(false)
        }
    }

    const handlePrint = () => {
        const client = quote.client_id ? clients.find((c) => c.id === quote.client_id) : undefined
        printQuote({
            quote,
            clientName: getClientName(quote.client_id),
            client,
            companyName,
            companyLogo,
            getStatusLabel,
        })
    }

    const clientDisplayName = quote.custom_recipient_info
        ? quote.custom_recipient_info.split("\n")[0]
        : quote.title

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] flex flex-col p-0 overflow-hidden sm:max-w-2xl">
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <DialogHeader className="p-6 pr-14 border-b border-[var(--border-soft)] flex-shrink-0">
                            <div className="flex items-start justify-between gap-4 w-full">
                                <div className="flex-1 min-w-0">
                                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                                        <FileText className="w-5 h-5 text-[var(--text-main)] flex-shrink-0" />
                                        {formatQuoteNumber(quote.quote_number)}
                                    </DialogTitle>
                                    <p className="text-sm text-[var(--text-muted)] mt-0.5 truncate">{quote.title}</p>
                                </div>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${QUOTE_STATUS_BADGE[quote.status] ?? QUOTE_STATUS_BADGE.draft}`}>
                                    {getStatusLabel(quote.status)}
                                </span>
                            </div>
                        </DialogHeader>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            <QuoteDetailMeta
                                quote={quote}
                                dict={dict}
                                clientName={getClientName(quote.client_id)}
                            />
                            <QuoteDetailItems quote={quote} dict={dict} />
                            <QuoteDetailNotes quote={quote} dict={dict} />
                        </div>

                        <QuoteDetailActions
                            quote={quote}
                            dict={dict}
                            loading={loading}
                            onPrint={handlePrint}
                            onEdit={() => {
                                onOpenChange(false)
                                router.push(`/dashboard/quotes/${quote.id}?edit=true`)
                            }}
                            onMarkSent={() => updateStatus("sent")}
                            onMarkAccepted={() => {
                                if (quote.client_id === null) {
                                    setShowRegisterClientPrompt(true)
                                } else {
                                    updateStatus("accepted")
                                }
                            }}
                            onMarkRejected={() => updateStatus("rejected")}
                            onClose={() => onOpenChange(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <RegisterClientDialog
                open={showRegisterClientPrompt}
                onOpenChange={setShowRegisterClientPrompt}
                loading={loading}
                clientDisplayName={clientDisplayName}
                onAcceptOnly={() => updateStatus("accepted", false)}
                onRegisterAndAccept={() => updateStatus("accepted", true)}
            />
        </>
    )
}
