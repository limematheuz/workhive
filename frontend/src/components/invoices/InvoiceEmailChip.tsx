import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InvoiceEmailChipProps = {
    email: string;
    onRemove: (email: string) => void;
    removeLabel: string;
    tone?: "primary" | "muted";
};

export function InvoiceEmailChip({
    email,
    onRemove,
    removeLabel,
    tone = "primary",
}: InvoiceEmailChipProps) {
    return (
        <span
            className={[
                "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
                tone === "primary"
                    ? "bg-accent/10 text-accent ring-1 ring-accent/15"
                    : "bg-[var(--bg-secondary)] text-[var(--text-main)] ring-1 ring-[var(--border-soft)]",
            ].join(" ")}
        >
            <span className="truncate">{email}</span>
            <Button
                type="button"
                onClick={() => onRemove(email)}
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-current/55 hover:text-current"
                aria-label={removeLabel.replace("{email}", email)}
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </span>
    );
}
