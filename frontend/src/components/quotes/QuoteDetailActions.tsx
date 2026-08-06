"use client"

import { Send, Download, Edit3, CheckCircle, Mail, XCircle } from "lucide-react"
import { Quote } from "@/types/quote"
import type { Dictionary } from "@/lib/dictionary-context"

interface QuoteDetailActionsProps {
    quote: Quote
    dict: Dictionary
    loading: boolean
    onDownload: () => void
    onSendEmail: () => void
    onEdit: () => void
    onMarkSent: () => void
    onMarkAccepted: () => void
    onMarkRejected: () => void
    onClose: () => void
}

export function QuoteDetailActions({
    quote,
    dict,
    loading,
    onDownload,
    onSendEmail,
    onEdit,
    onMarkSent,
    onMarkAccepted,
    onMarkRejected,
    onClose,
}: QuoteDetailActionsProps) {
    return (
        <div className="dialog-glass-chrome p-5 border-t border-[var(--border-soft)] flex-shrink-0">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onDownload}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors border-none cursor-pointer"
                >
                    <Download className="w-3.5 h-3.5" />
                    {dict.quotes?.download_pdf ?? "Descargar PDF"}
                </button>

                {(quote.status === "draft" || quote.status === "sent") && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onSendEmail}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-accent/10 text-accent border border-accent/30 rounded-xl hover:bg-accent/20 transition-colors cursor-pointer"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Enviar por email
                    </button>
                )}

                {quote.status === "draft" && (
                    <>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onEdit}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] border border-[var(--btn-neutral-border)] rounded-xl hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            {dict.quotes?.edit_quote ?? "Editar"}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onMarkSent}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-bg)] rounded-xl hover:bg-[var(--btn-primary-hover-bg)] transition-colors cursor-pointer"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {dict.quotes?.mark_sent ?? "Marcar enviado"}
                        </button>
                    </>
                )}
                {quote.status === "sent" && (
                    <>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onMarkAccepted}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-bg)] rounded-xl hover:bg-[var(--btn-primary-hover-bg)] transition-colors cursor-pointer"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {dict.quotes?.mark_accepted ?? "Marcar aceptado"}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onMarkRejected}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] rounded-xl hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] transition-colors cursor-pointer"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            {dict.quotes?.mark_rejected ?? "Marcar rechazado"}
                        </button>
                    </>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] border border-[var(--btn-neutral-border)] hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)] rounded-xl ui-motion cursor-pointer"
                >
                    {dict.clients?.form.cancel ?? "Cerrar"}
                </button>
            </div>
        </div>
    )
}
