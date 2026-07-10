"use client";

import Image from "next/image";
import { Building2, Mail, Phone, MapPin, CreditCard, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveApiMediaUrl } from "@/lib/api";
import type { Dictionary } from "@/lib/dictionary-context";

type CompanyDetailsFormFieldsProps = {
    dict: Dictionary;
    companyName: string;
    setCompanyName: (value: string) => void;
    taxId: string;
    setTaxId: (value: string) => void;
    address: string;
    setAddress: (value: string) => void;
    postalCode: string;
    setPostalCode: (value: string) => void;
    city: string;
    setCity: (value: string) => void;
    province: string;
    setProvince: (value: string) => void;
    phone: string;
    setPhone: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    bankAccount: string;
    setBankAccount: (value: string) => void;
    defaultPaymentNotes: string;
    setDefaultPaymentNotes: (value: string) => void;
    defaultDocumentTerms: string;
    setDefaultDocumentTerms: (value: string) => void;
    logoUrl: string | null;
    updating: boolean;
    onLogoChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCancel: () => void;
    onSubmit: (event: React.FormEvent) => void;
};

export function CompanyDetailsFormFields({
    dict,
    companyName,
    setCompanyName,
    taxId,
    setTaxId,
    address,
    setAddress,
    postalCode,
    setPostalCode,
    city,
    setCity,
    province,
    setProvince,
    phone,
    setPhone,
    email,
    setEmail,
    bankAccount,
    setBankAccount,
    defaultPaymentNotes,
    setDefaultPaymentNotes,
    defaultDocumentTerms,
    setDefaultDocumentTerms,
    logoUrl,
    updating,
    onLogoChange,
    onCancel,
    onSubmit,
}: CompanyDetailsFormFieldsProps) {
    return (
        <form onSubmit={onSubmit} className="space-y-6 w-full relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        Company Details
                    </h3>

                    <div className="space-y-1.5">
                        <label htmlFor="company-name" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            Company Name *
                        </label>
                        <input
                            id="company-name"
                            type="text"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="company-tax-id" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            CIF / NIF (Issuer NIF) *
                        </label>
                        <input
                            id="company-tax-id"
                            type="text"
                            required
                            value={taxId}
                            onChange={(e) => setTaxId(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-mono"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="company-address" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--text-muted)]" /> Fiscal Address *
                        </label>
                        <input
                            id="company-address"
                            type="text"
                            required
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <label htmlFor="company-postal-code" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                {dict.profile.company_fields.postal_code} *
                            </label>
                            <input
                                id="company-postal-code"
                                type="text"
                                required
                                inputMode="numeric"
                                pattern="[0-9]{5}"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="company-city" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                {dict.profile.company_fields.city} *
                            </label>
                            <input
                                id="company-city"
                                type="text"
                                required
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="company-province" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                {dict.profile.company_fields.province} *
                            </label>
                            <input
                                id="company-province"
                                type="text"
                                required
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label htmlFor="company-phone" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[var(--text-muted)]" /> Phone
                            </label>
                            <input
                                id="company-phone"
                                type="text"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="company-email" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                                <Mail className="w-3 h-3 text-[var(--text-muted)]" /> Email
                            </label>
                            <input
                                id="company-email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="company-bank-account" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Account Number / IBAN
                        </label>
                        <input
                            id="company-bank-account"
                            type="text"
                            value={bankAccount}
                            onChange={(e) => setBankAccount(e.target.value)}
                            placeholder="ES00 0000 0000 0000 0000 0000"
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/10 focus:bg-[var(--bg-card-solid)] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <Upload className="w-4 h-4" />
                        Corporate Logo
                    </h3>

                    <div className="border border-dashed border-[var(--border-color)] rounded-2xl p-6 bg-[var(--bg-tertiary)]/40 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group hover:border-accent hover:bg-accent/5 transition-all">
                        {logoUrl ? (
                            <div className="text-center space-y-4">
                                <Image
                                    src={resolveApiMediaUrl(logoUrl) || ""}
                                    alt="Logo"
                                    width={240}
                                    height={144}
                                    className="max-h-36 max-w-full object-contain mx-auto rounded"
                                    unoptimized
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-semibold">Change logo</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-2">
                                <Building2 className="w-10 h-10 text-accent/40 mx-auto" />
                                <span className="text-xs font-semibold text-[var(--text-main)] block">Upload your company logo</span>
                                <span className="text-3xs text-[var(--text-muted)]">The logo will appear on invoices and quotes.</span>
                            </div>
                        )}
                        <input
                            type="file"
                            aria-label="Upload company logo"
                            accept="image/*"
                            onChange={onLogoChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--border-soft)] pt-5">
                <div className="space-y-1.5">
                    <label htmlFor="company-default-payment-notes" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile.company_fields.default_payment_notes}
                    </label>
                    <textarea
                        id="company-default-payment-notes"
                        value={defaultPaymentNotes}
                        onChange={(event) => setDefaultPaymentNotes(event.target.value)}
                        rows={5}
                        placeholder={dict.profile.company_fields.default_payment_notes_placeholder}
                        className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="company-default-document-terms" className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dict.profile.company_fields.default_document_terms}
                    </label>
                    <textarea
                        id="company-default-document-terms"
                        value={defaultDocumentTerms}
                        onChange={(event) => setDefaultDocumentTerms(event.target.value)}
                        rows={5}
                        placeholder={dict.profile.company_fields.default_document_terms_placeholder}
                        className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/70"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] border-none cursor-pointer"
                >
                    {dict.locations?.form?.cancel || "Cancel"}
                </Button>
                <Button
                    type="submit"
                    disabled={updating}
                    className="bg-[var(--text-main)] text-[var(--text-inverse)] hover:opacity-90 text-xs font-semibold px-6 border-none cursor-pointer"
                >
                    {updating ? "Saving..." : (dict.locations?.form?.save || "Save")}
                </Button>
            </div>
        </form>
    );
}
