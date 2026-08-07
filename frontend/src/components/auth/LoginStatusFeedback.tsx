"use client";

import { useEffect, useMemo, useState } from "react";
import {
    LoginErrorIllustration,
    LoginSuccessIllustration,
} from "@/components/auth/AuthStatusIllustrations";
import {
    LOGIN_STATUS_PHRASE_INTERVAL_MS,
    type LoginStatusVariant,
} from "@/lib/login-status";
import { cn } from "@/lib/utils";

type LoginStatusFeedbackProps = {
    variant: LoginStatusVariant;
    /** Primary line (API error or success title). */
    title?: string;
    /** Rotating secondary phrases — same motion for fail and success. */
    phrases: readonly string[];
    className?: string;
};

/**
 * Shared login outcome panel. Failure and success use the same layout + phrase
 * animation; success switches to accent-blue chrome for contrast on billing surfaces.
 */
export function LoginStatusFeedback({
    variant,
    title,
    phrases,
    className,
}: LoginStatusFeedbackProps) {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const isSuccess = variant === "success";
    const activePhrases = useMemo(() => {
        const cleaned = phrases.map((phrase) => phrase.trim()).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
        return title?.trim() ? [title.trim()] : [];
    }, [phrases, title]);
    const phrasesKey = activePhrases.join("\0");

    useEffect(() => {
        setPhraseIndex(0);
        const list = phrasesKey.length > 0 ? phrasesKey.split("\0") : [];
        if (list.length <= 1) return;
        const id = window.setInterval(() => {
            setPhraseIndex((current) => (current + 1) % list.length);
        }, LOGIN_STATUS_PHRASE_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [phrasesKey, variant]);

    const phrase = activePhrases[phraseIndex] ?? "";

    return (
        <div
            role={isSuccess ? "status" : "alert"}
            aria-live="polite"
            data-login-status={variant}
            className={cn(
                "login-status-panel overflow-hidden rounded-2xl border",
                isSuccess
                    ? "border-accent/40 bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-tertiary))]"
                    : "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)]",
                className,
            )}
        >
            <div className="flex justify-center px-4 pt-4">
                {isSuccess ? (
                    <LoginSuccessIllustration className="h-20 w-36 text-accent" />
                ) : (
                    <LoginErrorIllustration className="h-20 w-36 text-[var(--text-main)]" />
                )}
            </div>

            <div className="space-y-1.5 px-4 pb-4 text-center">
                {title ? (
                    <p
                        className={cn(
                            "text-sm font-semibold leading-snug",
                            isSuccess
                                ? "text-accent"
                                : "text-[var(--btn-cancel-text)]",
                        )}
                    >
                        {title}
                    </p>
                ) : null}
                {phrase ? (
                    <p
                        key={`${variant}-${phraseIndex}-${phrase}`}
                        className={cn(
                            "login-status-phrase text-xs leading-snug",
                            isSuccess
                                ? "text-[var(--text-muted)]"
                                : "text-[var(--btn-cancel-text)]/85",
                            title ? "" : "text-sm font-medium",
                        )}
                    >
                        {phrase}
                    </p>
                ) : null}
            </div>

            {isSuccess ? (
                <div
                    className="mx-auto mb-4 h-[2px] w-28 overflow-hidden rounded-full bg-accent/25"
                    aria-hidden
                >
                    <div className="h-full w-full origin-left scale-x-0 rounded-full bg-accent animate-[login-progress_0.7s_ease-out_forwards]" />
                </div>
            ) : null}
        </div>
    );
}
