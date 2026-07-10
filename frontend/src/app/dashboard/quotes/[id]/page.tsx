"use client";

import { useParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertTriangle } from "lucide-react"
import { RegisterClientDialog } from "@/components/quotes/RegisterClientDialog"
import { QuoteDetailActionBar } from "@/components/quotes/QuoteDetailActionBar"
import { QuoteDetailDocument } from "@/components/quotes/QuoteDetailDocument"
import { useQuoteDetail } from "@/hooks/useQuoteDetail"

export default function QuoteDetailPage() {
    const { id } = useParams()
    const quoteId = parseInt(id as string, 10)
    const {
        dict, user, userLoading, quote, client, company, loading,
        updatingStatus, showRegisterClientPrompt, setShowRegisterClientPrompt,
        isEditMode, editTitle, setEditTitle, editValidUntil,
        setEditValidUntil, editingItems, editNotes, setEditNotes, editTerms,
        setEditTerms, editDiscount, setEditDiscount, editTaxRate,
        setEditTaxRate, editEquivalenceSurcharge,
        setEditEquivalenceSurcharge, editRetention, setEditRetention,
        isSavingDraft, handleStatusChange, handlePrint, handleEnterEditMode,
        handleDiscardEdit, handleAddEditItem, handleRemoveEditItem,
        handleEditItemChange, handleSaveDraft, editSubtotal, editBaseAmount,
        editTaxAmount, editTotalAmount, getClientName, getStatusLabel,
        nextStates,
    } = useQuoteDetail(quoteId)

    if (userLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">{dict.quotes?.loading ?? "Cargando presupuesto..."}</span>
            </div>
        )
    }

    if (!user || (user.role?.name !== "admin" && user.role?.name !== "superadmin")) {
        return null
    }

    if (!quote) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 font-semibold">{dict.quotes?.error_load ?? "Presupuesto no encontrado."}</p>
                <Link href="/dashboard/quotes" className="text-accent underline text-sm mt-2 inline-block">
                    {dict.invoices?.back_to_list ?? "Volver a la lista"}
                </Link>
            </div>
        )
    }

    return (
        <div className="px-[3%] py-6 md:p-8 h-full overflow-y-auto print:p-0 print:overflow-visible print:bg-white print:text-black relative">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 dark:bg-accent/10 blur-[120px] pointer-events-none print:hidden" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] pointer-events-none print:hidden" />

            <QuoteDetailActionBar
                dict={dict}
                quote={quote}
                updatingStatus={updatingStatus}
                isEditMode={isEditMode}
                isSavingDraft={isSavingDraft}
                nextStates={nextStates}
                getStatusLabel={getStatusLabel}
                onShowRegisterClientPrompt={() => setShowRegisterClientPrompt(true)}
                onStatusChange={handleStatusChange}
                onEnterEditMode={handleEnterEditMode}
                onDiscardEdit={handleDiscardEdit}
                onSaveDraft={handleSaveDraft}
                onPrint={handlePrint}
            />

            {quote.status !== "draft" && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] p-4 rounded-xl mb-6 flex items-start gap-2.5 print:hidden">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                    <div className="text-xs">
                        <p className="font-semibold text-[var(--text-main)]">Presupuesto no modificable</p>
                        <p className="mt-0.5 text-[var(--text-muted)]">Solo los presupuestos en estado Borrador pueden ser editados directamente.</p>
                    </div>
                </div>
            )}

            <QuoteDetailDocument
                dict={dict}
                quote={quote}
                client={client}
                company={company}
                isEditMode={isEditMode}
                editTitle={editTitle}
                onEditTitleChange={setEditTitle}
                editValidUntil={editValidUntil}
                onEditValidUntilChange={setEditValidUntil}
                editingItems={editingItems}
                editNotes={editNotes}
                onEditNotesChange={setEditNotes}
                editTerms={editTerms}
                onEditTermsChange={setEditTerms}
                editDiscount={editDiscount}
                onEditDiscountChange={setEditDiscount}
                editTaxRate={editTaxRate}
                onEditTaxRateChange={setEditTaxRate}
                editEquivalenceSurcharge={editEquivalenceSurcharge}
                onEditEquivalenceSurchargeChange={setEditEquivalenceSurcharge}
                editRetention={editRetention}
                onEditRetentionChange={setEditRetention}
                onAddEditItem={handleAddEditItem}
                onRemoveEditItem={handleRemoveEditItem}
                onEditItemChange={handleEditItemChange}
                editSubtotal={editSubtotal}
                editBaseAmount={editBaseAmount}
                editTaxAmount={editTaxAmount}
                editTotalAmount={editTotalAmount}
                getClientName={getClientName}
                getStatusLabel={getStatusLabel}
            />

            <RegisterClientDialog
                open={showRegisterClientPrompt}
                onOpenChange={setShowRegisterClientPrompt}
                loading={updatingStatus}
                clientDisplayName={quote.custom_recipient_info ? quote.custom_recipient_info.split("\n")[0] : quote.title || "Cliente"}
                onAcceptOnly={() => handleStatusChange("accepted", false)}
                onRegisterAndAccept={() => handleStatusChange("accepted", true)}
            />
        </div>
    )
}
