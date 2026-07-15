"use client";

import { Eye, Lock } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";

type TaskEditFormAlertsProps = {
    dict: Dictionary;
    immutable: boolean;
    isAdminOrManager: boolean;
};

export function TaskEditFormAlerts({
    dict,
    immutable,
    isAdminOrManager,
}: TaskEditFormAlertsProps) {
    if (immutable) {
        return (
            <div className="flex items-start gap-3 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 text-purple-400">
                <Lock className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-xs font-semibold">
                    <p className="font-extrabold uppercase tracking-wide">
                        {dict.tasks?.dialog?.invoiced_title || "Invoiced Task (Immutable)"}
                    </p>
                    <p className="mt-1 font-medium leading-relaxed text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.invoiced_desc || "This task is linked to a legal invoice and is locked. Fields cannot be modified to comply with billing integrity regulations."}
                    </p>
                </div>
            </div>
        );
    }

    if (!isAdminOrManager) {
        return (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 text-[var(--text-muted)]">
                <Eye className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-xs font-semibold">
                    <p className="font-extrabold uppercase tracking-wide text-[var(--text-main)]">
                        {dict.tasks?.dialog?.readonly_title || "Read Only Mode"}
                    </p>
                    <p className="mt-1 font-medium leading-relaxed text-[var(--text-muted)]">
                        {dict.tasks?.dialog?.readonly_desc || "As a field operator, only administrators or team leads can modify task properties."}
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
