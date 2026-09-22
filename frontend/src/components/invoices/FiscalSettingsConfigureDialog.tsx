"use client";

import { ChangeEvent } from "react";
import { CheckCircle2, FileKey2, Loader2, ShieldCheck, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyFiscalSettings } from "@/services/fiscal-settings.service";

import { FiscalSettingsText } from "./fiscalSettingsText";

type FiscalSettingsConfigureDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: CompanyFiscalSettings;
    text: FiscalSettingsText;
    certificateFile: File | null;
    certificatePassword: string;
    isSaving: boolean;
    onCertificateFile: (event: ChangeEvent<HTMLInputElement>) => void;
    onCertificatePasswordChange: (value: string) => void;
    onUpdate: (data: Partial<CompanyFiscalSettings>) => void;
    onUploadCertificate: () => void;
    onValidate: () => void;
};

export function FiscalSettingsConfigureDialog({
    open,
    onOpenChange,
    settings,
    text,
    certificateFile,
    certificatePassword,
    isSaving,
    onCertificateFile,
    onCertificatePasswordChange,
    onUpdate,
    onUploadCertificate,
    onValidate,
}: FiscalSettingsConfigureDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-[var(--border-soft)] p-6 pr-16">
                    <DialogTitle className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-main)]">
                            <ShieldCheck className="h-5 w-5" />
                        </span>
                        {text.title}
                    </DialogTitle>
                    <DialogDescription>
                        {text.dialogDescription}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 text-xs leading-5 text-[var(--text-muted)]">
                        <p className="font-black text-[var(--text-main)]">{text.fileHelpTitle}</p>
                        <p className="mt-1">
                            {text.fileHelpBody}
                        </p>
                        <p className="mt-2">
                            {text.fileHelpStorage}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-4 text-sm font-black text-[var(--text-main)]">
                            <Checkbox
                                checked={settings.company_enabled}
                                disabled={isSaving}
                                onCheckedChange={(checked) =>
                                    void onUpdate({ enabled: checked === true })
                                }
                            />
                            {text.activateCompany}
                        </label>
                        <Select
                            value={settings.environment}
                            disabled={isSaving}
                            onValueChange={(value) =>
                                void onUpdate({
                                    environment: value as "test" | "production",
                                })
                            }
                        >
                            <SelectTrigger aria-label={text.environmentAriaLabel} className="h-11 rounded-2xl px-4 text-sm font-black"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="test">{text.testOption}</SelectItem><SelectItem value="production">{text.productionOption}</SelectItem></SelectContent>
                        </Select>
                    </div>

                    <label className="block rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-secondary)] p-5 transition hover:border-[var(--border-color)]">
                        <input
                            type="file"
                            accept=".p12,.pfx,application/x-pkcs12"
                            onChange={onCertificateFile}
                            disabled={isSaving}
                            className="sr-only"
                        />
                        <span className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-card-solid)] text-[var(--text-main)]">
                                <FileKey2 className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-black text-[var(--text-main)]">
                                    {text.selectCertificate}
                                </span>
                                <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                                    {certificateFile?.name || text.noCertificate}
                                </span>
                            </span>
                        </span>
                    </label>

                    <Input
                        type="password"
                        value={certificatePassword}
                        onChange={(event) => onCertificatePasswordChange(event.target.value)}
                        placeholder={text.passwordPlaceholder}
                        disabled={isSaving}
                        className="h-11 rounded-2xl bg-[var(--bg-secondary)]"
                    />
                </div>

                <DialogFooter className="dialog-glass-chrome border-t border-[var(--border-soft)] p-6">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                        className="rounded-2xl font-black"
                    >
                        {text.close}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void onUploadCertificate()}
                        disabled={!certificateFile || !certificatePassword || isSaving}
                        className="rounded-2xl font-black"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <UploadCloud className="h-4 w-4" />
                        )}
                        {text.saveCertificate}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void onValidate()}
                        disabled={isSaving}
                        className="rounded-2xl font-black"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        {text.validateAeat}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
