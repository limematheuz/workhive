"use client";

import React from "react";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { CompanyService } from "@/services/company.service";
import { UploadService } from "@/services/upload.service";
import { resolveApiMediaUrl } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Dictionary } from "@/lib/dictionary-context";

interface CompanyLogoUploadProps {
    logoUrl: string | null;
    onLogoChange: (url: string | null) => void;
    dict: Dictionary;
    companyId?: number | null;
}

export function CompanyLogoUpload({
    logoUrl,
    onLogoChange,
    dict,
    companyId,
}: CompanyLogoUploadProps) {
    const [uploading, setUploading] = React.useState(false);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            setUploading(true);
            const uploadToast = toast.loading("Subiendo logotipo...");
            
            // 1. Upload the file to the server
            const result = await UploadService.uploadFile(file, "company");
            
            // 2. Propagate the change to the form
            onLogoChange(result.url);
            
            // 3. Save to the database when a company ID exists
            if (companyId) {
                await CompanyService.updateCompany(companyId, { logo: result.url });
                toast.success(dict.onboarding?.company_saved || "Logo de empresa actualizado", { id: uploadToast });
            } else {
                toast.success("Logo cargado", { id: uploadToast });
            }
        } catch (error) {
            console.error("Error saving logo", error);
            toast.error("Error al guardar logo");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1 flex flex-col justify-end">
            <Label className="text-xs text-[var(--text-muted)] font-medium mb-1">
                {dict.invoices?.company_logo || "Logo de Empresa"}
            </Label>
            <div className="border border-dashed border-[var(--border-color)] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors h-[86px] relative overflow-hidden group">
                {uploading ? (
                    <div className="text-center space-y-1">
                        <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto" />
                        <span className="text-3xs font-semibold text-[var(--text-muted)] block">Subiendo...</span>
                    </div>
                ) : logoUrl ? (
                    <>
                        <Image
                            src={resolveApiMediaUrl(logoUrl) || ""}
                            alt="Logo"
                            width={180}
                            height={70}
                            className="max-h-[70px] max-w-full object-contain"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-4 h-4 text-white" />
                        </div>
                    </>
                ) : (
                    <div className="text-center space-y-1">
                        <Upload className="w-4 h-4 text-accent mx-auto" />
                        <span className="text-3xs font-semibold text-[var(--text-main)] block">
                            {dict.invoices?.upload_logo || "Subir logo"}
                        </span>
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    aria-label={dict.invoices?.upload_logo || "Subir logo"}
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
}
