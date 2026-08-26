"use client";

import React from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import type {
    BillingPartyField,
    BillingPartyFields,
} from "@/lib/billing-party";
import { normalizeSwiftBicInput } from "@/lib/banking";
import { Input } from "@/components/ui/input";

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
                        {(structuredFields.postalCode || structuredFields.city || structuredFields.province) && (
                            <div className="flex flex-wrap gap-x-3">
                                {structuredFields.postalCode && <div><span className="text-[var(--text-muted)] font-semibold">CP:</span> {structuredFields.postalCode}</div>}
                                {structuredFields.city && <div><span className="text-[var(--text-muted)] font-semibold">Ciudad:</span> {structuredFields.city}</div>}
                                {structuredFields.province && <div><span className="text-[var(--text-muted)] font-semibold">Provincia:</span> {structuredFields.province}</div>}
                            </div>
                        )}
                        {structuredFields.country && (
                            <div><span className="text-[var(--text-muted)] font-semibold">País:</span> {structuredFields.country}</div>
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
                        {isIssuer && structuredFields.swiftBic && (
                            <div>
                                <span className="text-[var(--text-muted)] font-semibold">SWIFT/BIC:</span>{" "}
                                <span className="font-mono text-2xs">{structuredFields.swiftBic}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 pt-1 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-name`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_name || "Nombre"}</label>
                                <Input
                                    id={`${type}-party-name`}
                                    type="text" 
                                    aria-label={dict.invoices?.field_name || "Nombre"}
                                    value={structuredFields.name} 
                                    onChange={(e) => onChangeField("name", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-tax-id`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_tax_id || "NIF/CIF"}</label>
                                <Input
                                    id={`${type}-party-tax-id`}
                                    type="text" 
                                    aria-label={dict.invoices?.field_tax_id || "NIF/CIF"}
                                    value={structuredFields.taxId} 
                                    onChange={(e) => onChangeField("taxId", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <label htmlFor={`${type}-party-address`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_address || "Dirección"}</label>
                            <Input
                                id={`${type}-party-address`}
                                type="text" 
                                aria-label={dict.invoices?.field_address || "Dirección"}
                                value={structuredFields.address} 
                                onChange={(e) => onChangeField("address", e.target.value)} 
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr]">
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-postal-code`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">CP</label>
                                <Input
                                    id={`${type}-party-postal-code`}
                                    type="text"
                                    aria-label="Código postal"
                                    value={structuredFields.postalCode || ""}
                                    onChange={(e) => onChangeField("postalCode", e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-city`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ciudad</label>
                                <Input
                                    id={`${type}-party-city`}
                                    type="text"
                                    aria-label="Ciudad"
                                    value={structuredFields.city || ""}
                                    onChange={(e) => onChangeField("city", e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-province`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Provincia</label>
                                <Input
                                    id={`${type}-party-province`}
                                    type="text"
                                    aria-label="Provincia"
                                    value={structuredFields.province || ""}
                                    onChange={(e) => onChangeField("province", e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label htmlFor={`${type}-party-country`} className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">País</label>
                                <Input
                                    id={`${type}-party-country`}
                                    type="text"
                                    aria-label="País"
                                    value={structuredFields.country || ""}
                                    onChange={(e) => onChangeField("country", e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_phone || "Teléfono"}</label>
                                <Input
                                    type="text" 
                                    aria-label={dict.invoices?.field_phone || "Teléfono"}
                                    value={structuredFields.phone} 
                                    onChange={(e) => onChangeField("phone", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_email || "Email"}</label>
                                <Input
                                    type="email" 
                                    aria-label={dict.invoices?.field_email || "Email"}
                                    value={structuredFields.email} 
                                    onChange={(e) => onChangeField("email", e.target.value)} 
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        {isIssuer && (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="space-y-0.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{dict.invoices?.field_bank || "Banco / IBAN"}</label>
                                    <Input
                                        type="text"
                                        aria-label={dict.invoices?.field_bank || "Banco / IBAN"}
                                        value={structuredFields.bank || ""}
                                        onChange={(e) => onChangeField("bank", e.target.value)}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono"
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <label htmlFor="issuer-swift-bic" className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">SWIFT / BIC</label>
                                    <Input
                                        id="issuer-swift-bic"
                                        type="text"
                                        aria-label="SWIFT / BIC"
                                        value={structuredFields.swiftBic || ""}
                                        onChange={(e) => onChangeField("swiftBic", normalizeSwiftBicInput(e.target.value))}
                                        maxLength={11}
                                        pattern="[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?"
                                        title="8 u 11 caracteres: entidad, país y código BIC"
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono uppercase"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
