"use client";

import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Dialog-friendly control sizing; global dialog CSS still supplies surface colors. */
export const documentControlClassName =
    "h-11 min-h-11 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm text-[var(--text-main)] shadow-none";

export function DocumentFormInput({
    className,
    ...props
}: ComponentProps<typeof Input>) {
    return <Input className={cn(documentControlClassName, className)} {...props} />;
}

export function DocumentFormSelect({
    className,
    ...props
}: ComponentProps<"select">) {
    return (
        <select
            data-slot="select"
            className={cn(documentControlClassName, "appearance-auto", className)}
            {...props}
        />
    );
}

export function DocumentFormTextarea({
    className,
    ...props
}: ComponentProps<"textarea">) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                documentControlClassName,
                "h-auto min-h-[4.5rem] resize-y py-2.5 leading-5",
                className,
            )}
            {...props}
        />
    );
}
