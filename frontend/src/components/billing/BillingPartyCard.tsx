"use client";

import React from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import type {
    BillingPartyField,
    BillingPartyFields,
} from "@/lib/billing-party";

export type { BillingPartyFields } from "@/lib/billing-party";

interface BillingPartyCardProps {
    type: "issuer" | "recipient";
    dict: Dictionary;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    structuredFields: BillingPartyFields;
    onChangeField: (field: BillingPartyField, val: string) => void;
    canToggleEditing?: boolean;
}

export function BillingPartyCard({
    type,
    dict,
    isEditing,
    setIsEditing,
    structuredFields,
    onChangeField,
    canToggleEditing = true,
}: BillingPartyCardProps) {
    const isIssuer = type === "issuer";
    
    const labelTitle = isIssuer 
        ? (dict.invoices?.from_label || "De (Mi Empresa)")
        : (dict.invoices?.to_label || "Para (Cliente)");
        
    return (
        <div className="space-y-1">
            <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-soft)] rounded-2xl p-4 space-y-3 text-xs relative flex flex-col justify-between h-full min-h-[160px]">
                <div className="flex justify-between items-center">
                    <span className="font-extrabold text-[var(--text-muted)] uppercase tracking-wider text-3xs">{labelTitle}</span>
                    {canToggleEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(!isEditing)}
                            className="text-3xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-main)] font-extrabold px-2.5 py-1 rounded-lg ui-motion cursor-pointer uppercase tracking-wider"
                        >
                            {isEditing ? (dict.invoices?.done || "Listo") : (dict.invoices?.edit || "Editar")}
                        </button>
                    )}
                </div>
                {!isEditing ? (
                    <div className="space-y-1 font-sans text-[var(--text-main)] flex-1">
                        <div className="font-bold text-sm text-[var(--text-main)]">
                            {structuredFields.name || (dict.invoices?.field_name || "Nombre")}
                        </div>
                        {structuredFields.taxId && (
                            <div>
                                <span className="text-[var(--text-muted)] font-semibold">{dict.invoices?.field_tax_id || "NIF/CIF"}:</span>{" "}
                                <span className="font-mono text-2xs">{structuredFields.taxId}</span>
                            </div>
                        )}
                        {structuredFields.address && (
                            <div>
                                <span className="text-[var(--text-muted)] font-semibold">{dict.invoices?.field_address || "Dirección"}:</span>{" "}
                                {structuredFields.address}
                            </div>
                        )}
                        {(structuredFields.phone || structuredFields.email) && (
                            <div className="flex flex-wrap gap-x-3">
                                {structuredFields.phone && (
                                    <div>
                                        <span className="text-[var(--text-muted)] font-semibold">{dict.invoices?.field_phone || "Tel"}:</span>{" "}
                                        {structuredFields.phone}
                                    </div>
                                )}
                                {structuredFields.email && (
                                    <div>
                                        <span className="text-[var(--text-muted)] font-semibold">{dict.invoices?.field_email || "Email"}:</span>{" "}
                                        {structuredFields.email}
                                    </div>
                                )}
                            </div>
                        )}
                        {isIssuer && structuredFields.bank && (
                            <div>
                                <span className="text-[var(--text-muted)] font-semibold">{dict.invoices?.field_bank || "Banco"}:</span>{" "}
                                <span className="font-mono text-2xs">{structuredFields.bank}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 pt-1 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_name || "Nombre"}</label>
                                <input 
                                    type="text" 
                                    aria-label={dict.invoices?.field_name || "Nombre"}
                                    value={structuredFields.name} 
                                    onChange={(e) => onChangeField("name", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_tax_id || "NIF/CIF"}</label>
                                <input 
                                    type="text" 
                                    aria-label={dict.invoices?.field_tax_id || "NIF/CIF"}
                                    value={structuredFields.taxId} 
                                    onChange={(e) => onChangeField("taxId", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_address || "Dirección"}</label>
                            <input 
                                type="text" 
                                aria-label={dict.invoices?.field_address || "Dirección"}
                                value={structuredFields.address} 
                                onChange={(e) => onChangeField("address", e.target.value)} 
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_phone || "Teléfono"}</label>
                                <input 
                                    type="text" 
                                    aria-label={dict.invoices?.field_phone || "Teléfono"}
                                    value={structuredFields.phone} 
                                    onChange={(e) => onChangeField("phone", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_email || "Email"}</label>
                                <input 
                                    type="email" 
                                    aria-label={dict.invoices?.field_email || "Email"}
                                    value={structuredFields.email} 
                                    onChange={(e) => onChangeField("email", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        {isIssuer && (
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_bank || "Banco / IBAN"}</label>
                                <input 
                                    type="text" 
                                    aria-label={dict.invoices?.field_bank || "Banco / IBAN"}
                                    value={structuredFields.bank || ""} 
                                    onChange={(e) => onChangeField("bank", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
