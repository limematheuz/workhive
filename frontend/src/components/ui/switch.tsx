"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { formControlSurfaceClassName } from "@/components/ui/control-styles";
import { cn } from "@/lib/utils";

function Switch({
    className,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent-color)] data-[state=checked]:bg-[var(--accent-color)]",
                formControlSurfaceClassName,
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="block h-5 w-5 rounded-full bg-[var(--bg-card-solid)] shadow-sm transition-transform data-[state=checked]:translate-x-5"
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
