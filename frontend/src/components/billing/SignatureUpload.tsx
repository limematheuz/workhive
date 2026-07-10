"use client";

import React from "react";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2 } from "lucide-react";
import { UploadService } from "@/services/upload.service";
import { resolveApiMediaUrl } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Dictionary } from "@/lib/dictionary-context";

interface SignatureUploadProps {
    signatureUrl: string | null;
    onSignatureChange: (url: string | null) => void;
    dict: Dictionary;
}

export function SignatureUpload({
    signatureUrl,
    onSignatureChange,
    dict,
}: SignatureUploadProps) {
    const [uploading, setUploading] = React.useState(false);

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            setUploading(true);
            const uploadToast = toast.loading("Subiendo firma...");
            const result = await UploadService.uploadFile(file, "signature");
            onSignatureChange(result.url);
            toast.success("Firma cargada correctamente", { id: uploadToast });
        } catch (error) {
            console.error("Error uploading signature", error);
            toast.error("Error al subir firma");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-muted)] font-medium block">
                {dict.invoices?.issuer_signature || "Firma del Emisor"}
            </Label>
            <div className="border border-dashed border-[var(--border-color)] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors h-[86px] relative overflow-hidden group">
                {uploading ? (
                    <div className="text-center space-y-1">
                        <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto" />
                        <span className="text-3xs font-semibold text-[var(--text-muted)] block">Subiendo...</span>
                    </div>
                ) : signatureUrl ? (
                    <>
                        <Image
                            src={resolveApiMediaUrl(signatureUrl) || ""}
                            alt="Firma"
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
                        <FileText className="w-4 h-4 text-accent mx-auto" />
                        <span className="text-3xs font-semibold text-[var(--text-main)] block">
                            {dict.invoices?.upload_signature || "Hacer/Subir Firma (opcional)"}
                        </span>
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    aria-label={dict.invoices?.upload_signature || "Subir firma"}
                    onChange={handleSignatureUpload}
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
}
