import React, { useReducer, useRef, useEffect } from "react";
import { User } from "@/types/user";
import { CompanyService } from "@/services/company.service";
import { UploadService } from "@/services/upload.service";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { CompanyDetailsFormFields } from "@/components/profile/CompanyDetailsFormFields";

interface CompanyDetailsFormProps {
    user: User;
    dict: Dictionary;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

type CompanyFormFields = {
    companyName: string;
    taxId: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    phone: string;
    email: string;
    bankAccount: string;
    swiftBic: string;
    defaultPaymentNotes: string;
    defaultDocumentTerms: string;
    logoUrl: string | null;
};

type CompanyFormState = CompanyFormFields & {
    loading: boolean;
    updating: boolean;
};

type CompanyFormAction =
    | { type: "loading"; value: boolean }
    | { type: "saving"; value: boolean }
    | { type: "loaded"; fields: CompanyFormFields }
    | { type: "fieldChanged"; field: keyof CompanyFormFields; value: string | null };

const EMPTY_FIELDS: CompanyFormFields = {
    companyName: "",
    taxId: "",
    address: "",
    postalCode: "",
    city: "",
    province: "",
    phone: "",
    email: "",
    bankAccount: "",
    swiftBic: "",
    defaultPaymentNotes: "",
    defaultDocumentTerms: "",
    logoUrl: null,
};

const initialState: CompanyFormState = {
    ...EMPTY_FIELDS,
    loading: true,
    updating: false,
};

function companyFormReducer(state: CompanyFormState, action: CompanyFormAction): CompanyFormState {
    switch (action.type) {
        case "loading":
            return { ...state, loading: action.value };
        case "saving":
            return { ...state, updating: action.value };
        case "loaded":
            return { ...state, ...action.fields, loading: false };
        case "fieldChanged":
            return { ...state, [action.field]: action.value };
        default:
            return state;
    }
}

export function CompanyDetailsForm({ user, dict, onCancel, onSuccess }: CompanyDetailsFormProps) {
    const [form, dispatch] = useReducer(companyFormReducer, initialState);
    const logoUploadingRef = useRef(false);

    useEffect(() => {
        if (!user.company_id) {
            dispatch({ type: "loading", value: false });
            return;
        }
        let cancelled = false;

        const fetchCompany = async () => {
            try {
                dispatch({ type: "loading", value: true });
                const comp = await CompanyService.getCompany(user.company_id!);
                if (cancelled) return;
                dispatch({
                    type: "loaded",
                    fields: {
                        companyName: comp.name || "",
                        taxId: comp.tax_id || "",
                        address: comp.address || "",
                        postalCode: comp.postal_code || "",
                        city: comp.city || "",
                        province: comp.province || "",
                        phone: comp.phone || "",
                        email: comp.email || "",
                        bankAccount: comp.bank_account || "",
                        swiftBic: comp.swift_bic || "",
                        defaultPaymentNotes: comp.default_payment_notes || "",
                        defaultDocumentTerms: comp.default_document_terms || "",
                        logoUrl: comp.logo ?? null,
                    },
                });
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading company details:", err);
                toast.error(dict.invoices?.error_load || "Error loading company details");
                dispatch({ type: "loading", value: false });
            }
        };

        void fetchCompany();
        return () => {
            cancelled = true;
        };
    }, [user.company_id, dict]);

    const setField = (field: keyof CompanyFormFields) => (value: string) => {
        dispatch({ type: "fieldChanged", field, value });
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            logoUploadingRef.current = true;
            const uploadToast = toast.loading("Uploading company logo...");
            const result = await UploadService.uploadFile(file, "company");
            dispatch({ type: "fieldChanged", field: "logoUrl", value: result.url });
            toast.success("Logo loaded in form", { id: uploadToast });
        } catch (error: unknown) {
            console.error("Error uploading logo:", error);
            toast.error(getErrorMessage(error, "Error uploading logo"));
        } finally {
            logoUploadingRef.current = false;
        }
    };

    const handleUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user.company_id) return;
        if (logoUploadingRef.current) {
            toast.error("Please wait for the logo to finish uploading");
            return;
        }

        try {
            dispatch({ type: "saving", value: true });
            const payload = {
                name: form.companyName,
                tax_id: form.taxId,
                address: form.address,
                postal_code: form.postalCode,
                city: form.city,
                province: form.province,
                phone: form.phone,
                email: form.email,
                bank_account: form.bankAccount || null,
                swift_bic: form.swiftBic || null,
                default_payment_notes: form.defaultPaymentNotes || null,
                default_document_terms: form.defaultDocumentTerms || null,
                logo: form.logoUrl || null,
            };

            await CompanyService.updateCompany(user.company_id, payload);
            toast.success("Company profile updated successfully");
            await onSuccess();
        } catch (err: unknown) {
            console.error("Error updating company details:", err);
            toast.error(getErrorMessage(err, "Error saving company details"));
        } finally {
            dispatch({ type: "saving", value: false });
        }
    };

    if (form.loading) {
        return (
            <div className="flex justify-center py-10 items-center">
                <Loader2 className="animate-spin h-6 w-6 text-accent" />
            </div>
        );
    }

    if (!user.company_id) {
        return (
            <div className="py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/35 rounded-xl border border-[var(--border-soft)]">
                You do not belong to any registered company.
            </div>
        );
    }

    return (
        <CompanyDetailsFormFields
            dict={dict}
            companyName={form.companyName}
            setCompanyName={setField("companyName")}
            taxId={form.taxId}
            setTaxId={setField("taxId")}
            address={form.address}
            setAddress={setField("address")}
            postalCode={form.postalCode}
            setPostalCode={setField("postalCode")}
            city={form.city}
            setCity={setField("city")}
            province={form.province}
            setProvince={setField("province")}
            phone={form.phone}
            setPhone={setField("phone")}
            email={form.email}
            setEmail={setField("email")}
            bankAccount={form.bankAccount}
            setBankAccount={setField("bankAccount")}
            swiftBic={form.swiftBic}
            setSwiftBic={setField("swiftBic")}
            defaultPaymentNotes={form.defaultPaymentNotes}
            setDefaultPaymentNotes={setField("defaultPaymentNotes")}
            defaultDocumentTerms={form.defaultDocumentTerms}
            setDefaultDocumentTerms={setField("defaultDocumentTerms")}
            logoUrl={form.logoUrl}
            updating={form.updating}
            onLogoChange={handleLogoChange}
            onCancel={onCancel}
            onSubmit={handleUpdateCompany}
        />
    );
}
