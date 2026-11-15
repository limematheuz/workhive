"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReadErrorKind } from "@/lib/read-recovery";
import { cn } from "@/lib/utils";

type ReadRecoveryBannerProps = {
    kind: ReadErrorKind;
    message: string;
    retryLabel?: string;
    onRetry?: () => void;
    retrying?: boolean;
    className?: string;
};

export function ReadRecoveryBanner({
    kind,
    message,
    retryLabel = "Reintentar",
    onRetry,
    retrying = false,
    className,
}: ReadRecoveryBannerProps) {
    const Icon = kind === "denied" ? ShieldAlert : AlertTriangle;

    return (
        <div
            role="alert"
            className={cn(
                "billing-surface flex flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--border-color)] px-4 py-3 text-left sm:flex-row sm:items-center",
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <Icon className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--text-main)]">{message}</p>
            </div>
            {kind === "unavailable" && onRetry && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
                    {retryLabel}
                </Button>
            )}
        </div>
    );
}
