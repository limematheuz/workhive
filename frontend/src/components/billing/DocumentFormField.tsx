"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DocumentFormFieldProps = {
    id?: string;
    label: string;
    hint?: string;
    children: ReactNode;
    className?: string;
    htmlFor?: string;
};

/** Full-width labeled control for document create/edit forms. */
export function DocumentFormField({
    id,
    label,
    hint,
    children,
    className,
    htmlFor,
}: DocumentFormFieldProps) {
    return (
        <div className={cn("flex min-w-0 w-full flex-col gap-1.5", className)}>
            <Label htmlFor={htmlFor ?? id} className="w-full">
                {label}
            </Label>
            {hint ? <p className="text-xs text-[var(--text-muted)]">{hint}</p> : null}
            <div className="min-w-0 w-full">{children}</div>
        </div>
    );
}
