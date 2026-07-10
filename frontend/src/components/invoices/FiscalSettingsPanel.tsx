"use client";

import { ChangeEvent, startTransition, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useDictionary } from "@/lib/dictionary-context";
import {
    CompanyFiscalSettings,
    FiscalSettingsService,
} from "@/services/fiscal-settings.service";

import { FiscalSettingsConfigureDialog } from "./FiscalSettingsConfigureDialog";
import { FiscalSettingsSummary } from "./FiscalSettingsSummary";
import { getFiscalSettingsText } from "./fiscalSettingsText";

interface FiscalSettingsPanelProps {
    onSettingsChanged?: () => void | Promise<void>;
}

export function FiscalSettingsPanel({
    onSettingsChanged,
}: FiscalSettingsPanelProps) {
    const { locale } = useDictionary();
    const text = getFiscalSettingsText(locale);
    const [settings, setSettings] = useState<CompanyFiscalSettings | null>(null);
    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [certificatePassword, setCertificatePassword] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            setSettings(await FiscalSettingsService.getSettings());
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, text.loadError));
        } finally {
            setIsLoading(false);
        }
    }, [text.loadError]);

    useEffect(() => {
        startTransition(() => {
            void loadSettings();
        });
    }, [loadSettings]);

    const refreshParent = async () => {
        if (onSettingsChanged) {
            await onSettingsChanged();
        }
    };

    const handleUpdate = async (data: Partial<CompanyFiscalSettings>) => {
        setIsSaving(true);
        try {
            const updated = await FiscalSettingsService.updateSettings({
                enabled: data.enabled,
                environment: data.environment,
            });
            setSettings(updated);
            await refreshParent();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, text.updateError));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCertificateFile = (event: ChangeEvent<HTMLInputElement>) => {
        setCertificateFile(event.target.files?.[0] || null);
    };

    const handleUploadCertificate = async () => {
        if (!certificateFile || !certificatePassword) return;
        setIsSaving(true);
        try {
            const updated = await FiscalSettingsService.uploadCertificate(
                certificateFile,
                certificatePassword
            );
            setSettings(updated);
            setCertificateFile(null);
            setCertificatePassword("");
            toast.success(text.certificateSaved);
            await refreshParent();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, text.certificateSaveError));
        } finally {
            setIsSaving(false);
        }
    };

    const handleValidate = async () => {
        setIsSaving(true);
        try {
            const updated = await FiscalSettingsService.validateSettings();
            setSettings(updated);
            toast.success(
                updated.submission_available
                    ? text.ready
                    : text.incomplete
            );
            await refreshParent();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, text.validateError));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto mb-4 flex w-full max-w-[112rem] items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-xs text-[var(--text-muted)] print:hidden">
                <Loader2 className="h-4 w-4 animate-spin" />
                {text.loading}
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="mx-auto mb-3 w-full max-w-[112rem] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 print:hidden">
            <FiscalSettingsSummary
                settings={settings}
                text={text}
                isSaving={isSaving}
                onConfigure={() => setIsDialogOpen(true)}
                onValidate={handleValidate}
            />

            <FiscalSettingsConfigureDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                settings={settings}
                text={text}
                certificateFile={certificateFile}
                certificatePassword={certificatePassword}
                isSaving={isSaving}
                onCertificateFile={handleCertificateFile}
                onCertificatePasswordChange={setCertificatePassword}
                onUpdate={handleUpdate}
                onUploadCertificate={handleUploadCertificate}
                onValidate={handleValidate}
            />
        </div>
    );
}
