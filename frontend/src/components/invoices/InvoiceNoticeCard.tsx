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
                "rounded-2xl border bg-[var(--bg-card-solid)] p-3.5 text-xs print:hidden",
                tone === "neutral" && "border-[var(--border-soft)]",
                tone === "warning" && "border-[var(--alert-warning-border)]",
                tone === "success" && "border-[var(--btn-secondary-border)]",
            )}
        >
            <div className="flex gap-3">
                <span
                    className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        tone === "neutral" && "bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                        tone === "warning" && "bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
                        tone === "success" && "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]",
                    )}
                >
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-[13px] font-black leading-5 text-[var(--text-main)]">{title}</p>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{children}</div>
                </div>
            </div>
        </div>
    );
}
