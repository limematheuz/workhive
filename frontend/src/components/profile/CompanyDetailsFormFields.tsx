"use client";

import Image from "next/image";
import { Building2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DocumentFormInput,
    DocumentFormTextarea,
} from "@/components/billing/DocumentFormControls";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { ProfileFormSection } from "@/components/profile/ProfileFormSection";
import { resolveApiMediaUrl } from "@/lib/api";
import { normalizeSwiftBicInput } from "@/lib/banking";
import type { Dictionary } from "@/lib/dictionary-context";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";

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
    swiftBic: string;
    setSwiftBic: (value: string) => void;
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
    swiftBic,
    setSwiftBic,
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
        <form onSubmit={onSubmit} className="relative z-10 w-full space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.75fr)] lg:gap-4 lg:items-start">
                <ProfileFormSection
                    title="Company Details"
                    description="Fiscal and contact details shown on invoices and quotes."
                    headerExtra={<Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
                >
                    <div className="flex w-full min-w-0 flex-col gap-3">
                        <DocumentFormField id="company-name" label="Company Name *">
                            <DocumentFormInput
                                id="company-name"
                                type="text"
                                required
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </DocumentFormField>

                        <DocumentFormField id="company-tax-id" label="CIF / NIF (Issuer NIF) *">
                            <DocumentFormInput
                                id="company-tax-id"
                                type="text"
                                required
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                className="font-mono"
                            />
                        </DocumentFormField>

                        <DocumentFormField id="company-address" label="Fiscal Address *">
                            <DocumentFormInput
                                id="company-address"
                                type="text"
                                required
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </DocumentFormField>

                        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                            <DocumentFormField
                                id="company-postal-code"
                                label={`${dict.profile.company_fields.postal_code} *`}
                            >
                                <DocumentFormInput
                                    id="company-postal-code"
                                    type="text"
                                    required
                                    inputMode="numeric"
                                    pattern="[0-9]{5}"
                                    value={postalCode}
                                    onChange={(e) => setPostalCode(e.target.value)}
                                />
                            </DocumentFormField>
                            <DocumentFormField
                                id="company-city"
                                label={`${dict.profile.company_fields.city} *`}
                            >
                                <DocumentFormInput
                                    id="company-city"
                                    type="text"
                                    required
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                />
                            </DocumentFormField>
                            <DocumentFormField
                                id="company-province"
                                label={`${dict.profile.company_fields.province} *`}
                            >
                                <DocumentFormInput
                                    id="company-province"
                                    type="text"
                                    required
                                    value={province}
                                    onChange={(e) => setProvince(e.target.value)}
                                />
                            </DocumentFormField>
                        </div>

                        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            <DocumentFormField id="company-phone" label="Phone">
                                <DocumentFormInput
                                    id="company-phone"
                                    type="text"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </DocumentFormField>
                            <DocumentFormField id="company-email" label="Email">
                                <DocumentFormInput
                                    id="company-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </DocumentFormField>
                        </div>

                        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            <DocumentFormField id="company-bank-account" label="Account Number / IBAN">
                                <DocumentFormInput
                                    id="company-bank-account"
                                    type="text"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                    placeholder="ES00 0000 0000 0000 0000 0000"
                                    className="font-mono"
                                />
                            </DocumentFormField>
                            <DocumentFormField id="company-swift-bic" label="SWIFT / BIC">
                                <DocumentFormInput
                                    id="company-swift-bic"
                                    type="text"
                                    value={swiftBic}
                                    onChange={(e) => setSwiftBic(normalizeSwiftBicInput(e.target.value))}
                                    placeholder="CAIXESBBXXX"
                                    maxLength={11}
                                    pattern="[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?"
                                    title="8 or 11 characters: bank, country, and BIC code"
                                    autoCapitalize="characters"
                                    className="font-mono uppercase"
                                />
                            </DocumentFormField>
                        </div>
                    </div>
                </ProfileFormSection>

                <ProfileFormSection
                    title="Corporate Logo"
                    description="Shown on invoices and quotes."
                    headerExtra={<Upload className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
                >
                    <div className="relative flex min-h-[10.5rem] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card-solid)]/40 p-4 transition-colors hover:border-accent hover:bg-accent/5 group">
                        {logoUrl ? (
                            <div className="space-y-2 text-center">
                                <Image
                                    src={resolveApiMediaUrl(logoUrl) || ""}
                                    alt="Logo"
                                    width={200}
                                    height={112}
                                    className="mx-auto max-h-28 max-w-full rounded object-contain"
                                    unoptimized
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="text-xs font-semibold text-white">Change logo</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 text-center">
                                <Building2 className="mx-auto h-8 w-8 text-accent/40" />
                                <span className="block text-xs font-semibold text-[var(--text-main)]">
                                    Upload your company logo
                                </span>
                                <span className="text-2xs text-[var(--text-muted)]">
                                    The logo will appear on invoices and quotes.
                                </span>
                            </div>
                        )}
                        <input
                            type="file"
                            aria-label="Upload company logo"
                            accept="image/*"
                            onChange={onLogoChange}
                            className="absolute inset-0 cursor-pointer opacity-0"
                        />
                    </div>
                </ProfileFormSection>
            </div>

            <ProfileFormSection
                title="Notes & terms"
                description="Defaults applied when creating invoices and quotes."
            >
                <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                    <DocumentFormField
                        id="company-default-payment-notes"
                        label={dict.profile.company_fields.default_payment_notes}
                    >
                        <DocumentFormTextarea
                            id="company-default-payment-notes"
                            value={defaultPaymentNotes}
                            onChange={(event) => setDefaultPaymentNotes(event.target.value)}
                            rows={4}
                            placeholder={dict.profile.company_fields.default_payment_notes_placeholder}
                        />
                    </DocumentFormField>
                    <DocumentFormField
                        id="company-default-document-terms"
                        label={dict.profile.company_fields.default_document_terms}
                    >
                        <DocumentFormTextarea
                            id="company-default-document-terms"
                            value={defaultDocumentTerms}
                            onChange={(event) => setDefaultDocumentTerms(event.target.value)}
                            rows={4}
                            placeholder={dict.profile.company_fields.default_document_terms_placeholder}
                        />
                    </DocumentFormField>
                </div>
            </ProfileFormSection>

            <div className="flex justify-end gap-2.5 border-t border-[var(--border-soft)] pt-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn-cancel-muted"
                >
                    {dict.locations?.form?.cancel || "Cancel"}
                </button>
                <Button
                    type="submit"
                    disabled={updating}
                    className={PAGE_ACTION_BUTTON_PRIMARY}
                >
                    {updating ? "Saving..." : (dict.locations?.form?.save || "Save")}
                </Button>
            </div>
        </form>
    );
}
