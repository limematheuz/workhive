import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function InvoiceNoticeCard({
    icon,
    title,
    children,
    tone = "neutral",
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
    tone?: "neutral" | "warning" | "success";
}) {
    return (
        <div
            className={cn(
                "rounded-2xl p-3.5 text-xs print:hidden",
                tone === "neutral" && "bg-[var(--bg-tertiary)]",
                tone === "warning" && "bg-[color-mix(in_srgb,var(--alert-warning-bg)_62%,var(--bg-tertiary))]",
                tone === "success" && "bg-[color-mix(in_srgb,var(--btn-secondary-bg)_62%,var(--bg-tertiary))]",
            )}
        >
            <div className="flex gap-3">
                <span
                    className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        tone === "neutral" && "bg-[var(--bg-tertiary)] text-[var(--text-muted)]",
                        tone === "warning" && "bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
                        tone === "success" && "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]",
                    )}
                >
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-5 text-[var(--text-main)]">{title}</p>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{children}</div>
                </div>
            </div>
        </div>
    );
}
