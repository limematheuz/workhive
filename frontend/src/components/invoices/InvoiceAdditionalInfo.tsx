"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/dictionary-context";

interface InvoiceAdditionalInfoProps {
    dict: Dictionary;
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
    notesEnabled,
    setNotesEnabled,
    notes,
    setNotes,
    termsEnabled,
    setTermsEnabled,
    terms,
    setTerms,
}: InvoiceAdditionalInfoProps) {
    return (
        <div className="space-y-4 pt-2 border-t border-[var(--border-soft)]">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                {dict.invoices?.additional_info || "Información adicional"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-[var(--text-main)] font-semibold">{dict.invoices?.payment_notes || "Notas de Pago"}</Label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-3xs text-[var(--text-muted)]">{notesEnabled ? (dict.invoices?.yes || "Sí") : (dict.invoices?.no || "No")}</span>
                            <input
                                type="checkbox"
                                checked={notesEnabled}
                                onChange={(e) => setNotesEnabled(e.target.checked)}
                                aria-label={dict.invoices?.payment_notes || "Notas de Pago"}
                                className="w-8 h-4 rounded-full bg-[var(--bg-secondary)] border-[var(--border-color)] checked:bg-accent accent-accent cursor-pointer"
                            />
                        </div>
                    </div>
                    {notesEnabled && (
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            aria-label={dict.invoices?.payment_notes || "Notas de Pago"}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors resize-none"
                        />
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-[var(--text-main)] font-semibold">{dict.invoices?.terms_conditions || "Términos y condiciones"}</Label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-3xs text-[var(--text-muted)]">{termsEnabled ? (dict.invoices?.yes || "Sí") : (dict.invoices?.no || "No")}</span>
                            <input
                                type="checkbox"
                                checked={termsEnabled}
                                onChange={(e) => setTermsEnabled(e.target.checked)}
                                aria-label={dict.invoices?.terms_conditions || "Términos y condiciones"}
                                className="w-8 h-4 rounded-full bg-[var(--bg-secondary)] border-[var(--border-color)] checked:bg-accent accent-accent cursor-pointer"
                            />
                        </div>
                    </div>
                    {termsEnabled && (
                        <textarea
                            value={terms}
                            onChange={(e) => setTerms(e.target.value)}
                            rows={3}
                            aria-label={dict.invoices?.terms_conditions || "Términos y condiciones"}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors resize-none"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
