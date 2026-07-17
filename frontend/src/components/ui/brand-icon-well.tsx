import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type BrandIconWellProps = {
    icon: ComponentType<{ className?: string }>;
    size?: "sm" | "md" | "lg";
    className?: string;
    iconClassName?: string;
};

const wellSize = {
    sm: "icon-well-sm",
    md: "icon-well-md",
    lg: "icon-well-lg",
} as const;

const glyphSize = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
} as const;

/** Squarish brand icon tile with light corner radius (macOS/iOS settings style). */
export function BrandIconWell({
    icon: Icon,
    size = "md",
    className,
    iconClassName,
}: BrandIconWellProps) {
    return (
        <div className={cn("icon-well", wellSize[size], className)}>
            <Icon className={cn(glyphSize[size], iconClassName)} />
        </div>
    );
}
