"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { formControlSurfaceClassName } from "@/components/ui/control-styles";

function Checkbox({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                "peer flex size-5 shrink-0 items-center justify-center rounded-md border outline-none transition disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent-color)] data-[state=checked]:bg-[var(--accent-color)] data-[state=checked]:text-white",
                formControlSurfaceClassName,
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="flex items-center justify-center"
            >
                <CheckIcon className="size-3.5" aria-hidden="true" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

export { Checkbox };
