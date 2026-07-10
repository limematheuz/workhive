"use client";

import { CheckCircle2, Loader2, Settings2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanyFiscalSettings } from "@/services/fiscal-settings.service";

import { FiscalSettingsText } from "./fiscalSettingsText";

type FiscalSettingsSummaryProps = {
    settings: CompanyFiscalSettings;
    text: FiscalSettingsText;
    isSaving: boolean;
    onConfigure: () => void;
    onValidate: () => void;
};

export function FiscalSettingsSummary({
    settings,
    text,
    isSaving,
    onConfigure,
    onValidate,
}: FiscalSettingsSummaryProps) {
    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 gap-2.5 sm:gap-3">
                <span
                    className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        settings.submission_available
                            ? "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]"
                            : "bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]"
                    )}
                >
                    <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-[13px] font-black leading-5 text-[var(--text-main)] sm:text-sm">
                        {text.title}
                    </p>
                    <p className="mt-1 hidden truncate text-[12px] leading-5 text-[var(--text-muted)] sm:block">
                        {settings.endpoint}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-black uppercase sm:gap-2">
                        <span
                            className={cn(
                                "rounded-full border px-2.5 py-1 leading-none",
                                settings.submission_available
                                    ? "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]"
                                    : "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]"
                            )}
                        >
                            {settings.submission_available ? text.readyBadge : text.incompleteBadge}
                        </span>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2.5 py-1 leading-none text-[var(--text-muted)]">
                            {settings.environment === "production" ? text.production : text.test}
                        </span>
                        {settings.certificate_configured && (
                            <span className="rounded-full border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] px-2.5 py-1 leading-none text-[var(--btn-secondary-text)]">
                                {text.certificateLoaded}
                            </span>
                        )}
                    </div>
                    {settings.missing_fields.length > 0 && (
                        <p className="mt-2 hidden text-[12px] leading-5 text-[var(--text-muted)] sm:block">
                            {text.missing}: {settings.missing_fields.join(", ")}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onConfigure}
                    className="h-10 w-full rounded-xl text-xs font-black sm:w-auto"
                >
                    <Settings2 className="h-4 w-4" />
                    {text.configure}
                </Button>
                <Button
                    type="button"
                    onClick={() => void onValidate()}
                    disabled={isSaving}
                    className="h-10 w-full rounded-xl text-xs font-black sm:w-auto"
                >
                    {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4" />
                    )}
                    {text.validate}
                </Button>
            </div>
        </div>
    );
}
