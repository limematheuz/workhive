"use client";

import { WorkHiveLogo } from "@/components/brand/WorkHiveLogo";

interface AuthLogoProps {
    className?: string;
    priority?: boolean;
}

export function AuthLogo({ className, priority = false }: AuthLogoProps) {
    return <WorkHiveLogo className={className} priority={priority} />;
}
