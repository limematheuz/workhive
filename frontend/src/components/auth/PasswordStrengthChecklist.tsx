"use client";

import { Check, X } from "lucide-react";
import {
    getPasswordChecks,
    getPasswordStrength,
} from "@/lib/password-strength";

interface PasswordStrengthChecklistProps {
    password: string;
    locale?: string;
}

export function PasswordStrengthChecklist({ password, locale = "es" }: PasswordStrengthChecklistProps) {
    const checks = getPasswordChecks(password, locale);
    const strength = getPasswordStrength(password, locale);
    const width = `${Math.max(8, (strength.score / checks.length) * 100)}%`;

    return (
        <div className="space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/60 p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {locale === "es" ? "Seguridad" : "Strength"}
                </span>
                <span className={`text-xs font-black uppercase tracking-[0.18em] ${strength.colorClass}`}>
                    {strength.label}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.fillClass}`}
                    style={{ width }}
                />
            </div>
            <div className="space-y-2">
                {checks.map((check) => (
                    <div
                        key={check.label}
                        className={`flex items-center gap-2 text-sm font-semibold ${
                            check.valid ? "text-emerald-500" : "text-[var(--text-muted)]"
                        }`}
                    >
                        {check.valid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        <span>{check.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
