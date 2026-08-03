"use client"

import Link from "next/link"
import {
    Loader2,
    ArrowLeft,
    Printer,
    Pencil,
    Check,
    X,
} from "lucide-react"
import { formatQuoteNumber } from "@/lib/format"
import type { Dictionary } from "@/lib/dictionary-context"
import type { Quote } from "@/types/quote"

interface QuoteDetailActionBarProps {
    dict: Dictionary
    quote: Quote
    updatingStatus: boolean
    isEditMode: boolean
    isSavingDraft: boolean
    nextStates: string[]
    getStatusLabel: (status: string) => string
    onShowRegisterClientPrompt: () => void
    onStatusChange: (state: string) => void
    onEnterEditMode: () => void
    onDiscardEdit: () => void
    onSaveDraft: () => void
    onPrint: () => void
}

export function QuoteDetailActionBar({
    dict,
    quote,
    updatingStatus,
    isEditMode,
    isSavingDraft,
    nextStates,
    getStatusLabel,
    onShowRegisterClientPrompt,
    onStatusChange,
    onEnterEditMode,
    onDiscardEdit,
    onSaveDraft,
    onPrint,
}: QuoteDetailActionBarProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 print:hidden">
            <div className="flex items-center gap-2">
                <Link
                    href="/dashboard/quotes"
                    className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] rounded-xl ui-motion"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                    <span className="text-xs text-[var(--text-muted)]">
                        {dict.quotes?.list_title ?? "Presupuesto"}
                    </span>
                    <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                        {formatQuoteNumber(quote.quote_number)}
                        <span className="bg-[var(--bg-primary)] border border-[var(--border-soft)] text-[10px] text-[var(--text-main)] font-semibold px-2 py-0.5 rounded">
                            {getStatusLabel(quote.status)}
                        </span>
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                {nextStates.length > 0 && !isEditMode && (
                    <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-soft)] p-1.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] px-2">
                            {dict.invoices?.change_status ?? "Cambiar estado"}:
                        </span>
                        {updatingStatus ? (
                            <Loader2 className="w-4 h-4 text-accent animate-spin mx-2" />
                        ) : (
                            <div className="flex items-center gap-1">
                                {nextStates.map((state) => {
                                    let btnColor = "bg-[var(--bg-primary)] border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[var(--text-main)]"
                                    if (state === "accepted") btnColor = "bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                                    if (state === "sent") btnColor = "bg-amber-600 hover:bg-amber-700 text-white border-none"

                                    let stateText = state
                                    if (state === "sent") stateText = dict.quotes?.mark_sent ?? "Marcar enviado"
                                    if (state === "accepted") stateText = dict.quotes?.mark_accepted ?? "Marcar aceptado"
                                    if (state === "rejected") stateText = dict.quotes?.mark_rejected ?? "Marcar rechazado"

                                    return (
                                        <button
                                            type="button"
                                            key={state}
                                            onClick={() => {
                                                if (state === "accepted" && quote.client_id === null) {
                                                    onShowRegisterClientPrompt()
                                                } else {
                                                    onStatusChange(state)
                                                }
                                            }}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ui-motion cursor-pointer ${btnColor}`}
                                        >
                                            {stateText}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {quote.status === "draft" && !isEditMode && (
                    <button
                        type="button"
                        onClick={onEnterEditMode}
                        className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 ui-motion cursor-pointer"
                    >
                        <Pencil className="w-4 h-4" />
                        {dict.quotes?.edit_quote ?? "Editar borrador"}
                    </button>
                )}

                {isEditMode && (
                    <>
                        <button
                            type="button"
                            onClick={onDiscardEdit}
                            disabled={isSavingDraft}
                            className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ui-motion cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                            {dict.clients?.form.cancel ?? "Descartar"}
                        </button>
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            disabled={isSavingDraft}
                            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ui-motion cursor-pointer disabled:opacity-50"
                        >
                            {isSavingDraft ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Guardar cambios
                        </button>
                    </>
                )}

                <button
                    type="button"
                    onClick={onPrint}
                    className="bg-accent hover:bg-accent/90 text-white rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 ui-motion shadow-sm border-none cursor-pointer"
                >
                    <Printer className="w-4 h-4" />
                    {dict.invoices?.print_pdf ?? "Imprimir PDF"}
                </button>
            </div>
        </div>
    )
}
