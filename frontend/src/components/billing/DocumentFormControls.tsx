"use client";

import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Dialog-friendly control sizing; global dialog CSS still supplies surface colors. */
export const documentControlClassName =
    "h-11 min-h-11 w-full min-w-0 rounded-xl px-3 text-sm";

export function DocumentFormInput({
    className,
    ...props
}: ComponentProps<typeof Input>) {
    return <Input className={cn(documentControlClassName, className)} {...props} />;
}

export function DocumentFormTextarea({
    className,
    ...props
}: ComponentProps<typeof Textarea>) {
    return (
        <Textarea
            className={cn(
                documentControlClassName,
                "h-auto min-h-[4.5rem] resize-y py-2.5 leading-5",
                className,
            )}
            {...props}
        />
    );
}
