"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/lib/toast"
import { DocumentEmailDialog } from "@/components/billing/DocumentEmailDialog"
import { QuoteEmailPayload, QuoteService } from "@/services/quote.service"
import { formatQuoteNumber } from "@/lib/format"
import { Quote, QuoteRevision } from "@/types/quote"
import { useDictionary } from "@/lib/dictionary-context"
import type { Client } from "@/services/client.service"
import {
    createQuoteClientRegistrationDraft,
    type QuoteClientRegistrationInput,
} from "@/lib/quote-client-registration"
import { RegisterClientDialog } from "./RegisterClientDialog"
import { QuoteDetailMeta } from "./QuoteDetailMeta"
import { QuoteDetailItems } from "./QuoteDetailItems"
import { QuoteDetailNotes } from "./QuoteDetailNotes"
import { QuoteDetailActions } from "./QuoteDetailActions"
import { QuoteDetailSummaryAside } from "./QuoteDetailSummaryAside"
import { QuoteRevisionHistoryDialog } from "./QuoteRevisionHistoryDialog"
import { getErrorMessage } from "@/lib/errors"

interface QuoteDetailSheetProps {
    quote: Quote | null
    open: boolean
    onOpenChange: (open: boolean) => void
    clients: Client[]
    onQuoteUpdated: () => void
    companyName?: string
    canManage: boolean
    onRevisionCreated: (quote: Quote) => void
}

export function QuoteDetailSheet({
    quote,
    open,
    onOpenChange,
    clients,
    onQuoteUpdated,
    companyName,
    canManage,
    onRevisionCreated,
}: QuoteDetailSheetProps) {
    const { dict } = useDictionary()
    const [loading, setLoading] = React.useState(false)
    const [showRegisterClientPrompt, setShowRegisterClientPrompt] = React.useState(false)
    const [showEmailDialog, setShowEmailDialog] = React.useState(false)
    const [isSendingEmail, setIsSendingEmail] = React.useState(false)
    const [showRevisionHistory, setShowRevisionHistory] = React.useState(false)
    const [revisions, setRevisions] = React.useState<QuoteRevision[]>([])
    const [loadingRevisions, setLoadingRevisions] = React.useState(false)

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

    const updateStatus = async (
        newStatus: string,
        clientRegistration?: QuoteClientRegistrationInput,
    ) => {
        setLoading(true)
        try {
            let successMessage = dict.quotes?.status_updated ?? "Estado actualizado"
            if (newStatus === "accepted") {
                await QuoteService.acceptQuote(quote.id, {
                    register_client: Boolean(clientRegistration),
                    ...(clientRegistration ? { client: clientRegistration } : {}),
                })
                successMessage = "Presupuesto aceptado. Se ha creado un contrato en borrador."
            } else {
                await QuoteService.updateQuote(quote.id, { status: newStatus })
            }
            toast.success(successMessage)
            onQuoteUpdated()
            onOpenChange(false)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Error al actualizar el presupuesto"))
        } finally {
            setLoading(false)
            setShowRegisterClientPrompt(false)
        }
    }

    const handleDownloadPdf = async () => {
        setLoading(true)
        try {
            const blob = await QuoteService.downloadQuotePdf(quote.id)
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `${quote.quote_number}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo descargar el presupuesto"))
        } finally {
            setLoading(false)
        }
    }

    const handleSendEmail = async (data: QuoteEmailPayload) => {
        setIsSendingEmail(true)
        try {
            await QuoteService.sendQuoteEmail(quote.id, data)
            toast.success("Presupuesto enviado por email")
            onQuoteUpdated()
            return true
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo enviar el presupuesto"))
            return false
        } finally {
            setIsSendingEmail(false)
        }
    }

    const handleShowRevisionHistory = async () => {
        setShowRevisionHistory(true)
        setLoadingRevisions(true)
        try {
            setRevisions(await QuoteService.getQuoteRevisions(quote.id))
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo cargar el historial de versiones"))
        } finally {
            setLoadingRevisions(false)
        }
    }

    const handleCreateRevision = async () => {
        setLoading(true)
        try {
            const revisedQuote = await QuoteService.createQuoteRevision(quote.id)
            toast.success("Revisión creada. Ya puedes actualizar el presupuesto.")
            onQuoteUpdated()
            onOpenChange(false)
            onRevisionCreated(revisedQuote)
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "No se pudo crear la revisión"))
        } finally {
            setLoading(false)
        }
    }

    const clientRegistrationDraft = createQuoteClientRegistrationDraft(quote)
    const documentClient = quote.client_id
        ? clients.find((client) => client.id === quote.client_id) ?? null
        : null
    const clientName = getClientName(quote.client_id)
    const statusLabel = getStatusLabel(quote.status)

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex max-h-[min(94vh,calc(100%-1rem))] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl lg:max-w-7xl">
                    <DialogTitle className="sr-only">
                        {formatQuoteNumber(quote.quote_number)} — {quote.title}
                    </DialogTitle>

                    <div className="flex flex-1 flex-col overflow-hidden">
                        <div className="flex-shrink-0 space-y-3 border-b border-[var(--border-soft)] p-3 sm:p-4">
                            <QuoteDetailActions
                                quote={quote}
                                dict={dict}
                                loading={loading}
                                canManage={canManage}
                                clientName={clientName}
                                statusLabel={statusLabel}
                                onDownload={handleDownloadPdf}
                                onSendEmail={() => setShowEmailDialog(true)}
                                onMarkSent={() => updateStatus("sent")}
                                onMarkAccepted={() => {
                                    if (quote.client_id === null) {
                                        setShowRegisterClientPrompt(true)
                                    } else {
                                        updateStatus("accepted")
                                    }
                                }}
                                onMarkRejected={() => updateStatus("rejected")}
                                onCreateRevision={() => void handleCreateRevision()}
                                onShowRevisionHistory={() => void handleShowRevisionHistory()}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                            <div className="relative isolate grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
                                <div className="billing-surface relative z-10 min-w-0 overflow-hidden rounded-[24px] p-4 sm:p-5 lg:p-6">
                                    <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" />

                                    <QuoteDetailMeta
                                        quote={quote}
                                        dict={dict}
                                        clientName={clientName}
                                        companyName={companyName}
                                        statusLabel={statusLabel}
                                    />
                                    <QuoteDetailItems quote={quote} dict={dict} />
                                    <QuoteDetailNotes quote={quote} dict={dict} />
                                </div>

                                <QuoteDetailSummaryAside
                                    quote={quote}
                                    dict={dict}
                                    statusLabel={statusLabel}
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <RegisterClientDialog
                open={showRegisterClientPrompt}
                onOpenChange={setShowRegisterClientPrompt}
                loading={loading}
                initialClient={clientRegistrationDraft}
                onAcceptOnly={() => updateStatus("accepted")}
                onRegisterAndAccept={(clientData) =>
                    updateStatus("accepted", clientData)
                }
            />

            <DocumentEmailDialog
                open={showEmailDialog}
                onOpenChange={setShowEmailDialog}
                invoiceNumber={quote.quote_number}
                defaultSubject={quote.title}
                defaultMessage="Adjuntamos el presupuesto solicitado."
                documentLabel="presupuesto"
                submitLabel="Enviar presupuesto"
                description={`Envía el presupuesto ${formatQuoteNumber(quote.quote_number)} en PDF.`}
                defaultEmail={documentClient?.email ?? ""}
                recipientClient={documentClient}
                fromName={companyName ?? "WorkHive"}
                isSending={isSendingEmail}
                onSend={handleSendEmail}
            />

            <QuoteRevisionHistoryDialog
                quote={quote}
                revisions={revisions}
                open={showRevisionHistory}
                loading={loadingRevisions}
                onOpenChange={setShowRevisionHistory}
            />
        </>
    )
}
