import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="card" className={cn("rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30 text-[var(--text-main)]", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

export { Card, CardContent };
