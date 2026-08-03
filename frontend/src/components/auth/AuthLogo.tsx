"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const AUTH_LOGO_STYLE: CSSProperties = {
    filter: "var(--logo-filter)",
    height: "auto",
};

interface AuthLogoProps {
    className?: string;
    priority?: boolean;
}

export function AuthLogo({ className, priority = false }: AuthLogoProps) {
    return (
        <Image
            src="/logo/black-logo.avif"
            alt="WorkHive Logo"
            width={481}
            height={123}
            priority={priority}
            sizes="(max-width: 640px) 10rem, 13rem"
            unoptimized
            className={cn("h-auto opacity-90 ui-motion", className)}
            style={AUTH_LOGO_STYLE}
        />
    );
}
