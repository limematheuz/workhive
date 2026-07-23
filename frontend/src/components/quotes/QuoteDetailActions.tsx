"use client"

import { Send, Download, Edit3, CheckCircle, XCircle } from "lucide-react"
import { Quote } from "@/types/quote"
import type { Dictionary } from "@/lib/dictionary-context"

interface QuoteDetailActionsProps {
    quote: Quote
    dict: Dictionary
    loading: boolean
    onPrint: () => void
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
    onPrint,
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
                    onClick={onPrint}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors border-none cursor-pointer"
                >
                    <Download className="w-3.5 h-3.5" />
                    {dict.quotes?.download_pdf ?? "Descargar PDF"}
                </button>

                {quote.status === "draft" && (
                    <>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onEdit}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-accent/10 text-accent border border-accent/30 rounded-xl hover:bg-accent/20 transition-colors cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            {dict.quotes?.edit_quote ?? "Editar"}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onMarkSent}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer"
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
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-colors cursor-pointer"
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
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent rounded-xl transition-all cursor-pointer"
                >
                    {dict.clients?.form.cancel ?? "Cerrar"}
                </button>
            </div>
        </div>
    )
}
