"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Dictionary } from "@/lib/dictionary-context";

interface InvoiceAdditionalInfoProps {
    dict: Dictionary;
    variant?: "invoice" | "quote";
    notesEnabled: boolean;
    setNotesEnabled: (val: boolean) => void;
    notes: string;
    setNotes: (val: string) => void;
    termsEnabled: boolean;
    setTermsEnabled: (val: boolean) => void;
    terms: string;
    setTerms: (val: string) => void;
}

export function InvoiceAdditionalInfo({
    dict,
    variant = "invoice",
    notesEnabled,
    setNotesEnabled,
    notes,
    setNotes,
    termsEnabled,
    setTermsEnabled,
    terms,
    setTerms,
}: InvoiceAdditionalInfoProps) {
    const isQuote = variant === "quote";
    const notesLabel = isQuote ? "Observaciones y servicios" : (dict.invoices?.payment_notes || "Notas de pago");
    const termsLabel = isQuote ? "Condiciones del presupuesto" : (dict.invoices?.terms_conditions || "Términos y condiciones");

    return (
        <div className="space-y-4 pt-2 border-t border-[var(--border-soft)]">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                {dict.invoices?.additional_info || "Información adicional"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-[var(--text-main)] font-semibold">{notesLabel}</Label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-3xs text-[var(--text-muted)]">{notesEnabled ? (dict.invoices?.yes || "Sí") : (dict.invoices?.no || "No")}</span>
                            <Checkbox
                                checked={notesEnabled}
                                onCheckedChange={(checked) => setNotesEnabled(checked === true)}
                                aria-label={notesLabel}
                                className="size-5 rounded-md border-[var(--border-color)] bg-[var(--bg-card-solid)] shadow-none data-[state=checked]:border-accent data-[state=checked]:bg-accent"
                            />
                        </div>
                    </div>
                    {notesEnabled && (
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                            aria-label={dict.invoices?.payment_notes || "Notas de Pago"}
                            placeholder={isQuote ? "Servicios incluidos, detalles relevantes y observaciones para el cliente" : undefined}
                            className="min-h-32 w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                        />
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-[var(--text-main)] font-semibold">{termsLabel}</Label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-3xs text-[var(--text-muted)]">{termsEnabled ? (dict.invoices?.yes || "Sí") : (dict.invoices?.no || "No")}</span>
                            <Checkbox
                                checked={termsEnabled}
                                onCheckedChange={(checked) => setTermsEnabled(checked === true)}
                                aria-label={termsLabel}
                                className="size-5 rounded-md border-[var(--border-color)] bg-[var(--bg-card-solid)] shadow-none data-[state=checked]:border-accent data-[state=checked]:bg-accent"
                            />
                        </div>
                    </div>
                    {termsEnabled && (
                        <textarea
                            value={terms}
                            onChange={(e) => setTerms(e.target.value)}
                            rows={4}
                            aria-label={dict.invoices?.terms_conditions || "Términos y condiciones"}
                            placeholder={isQuote ? "Validez, forma de pago, horarios y servicios no incluidos" : undefined}
                            className="min-h-32 w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-main)] outline-none transition-colors focus:border-accent"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
