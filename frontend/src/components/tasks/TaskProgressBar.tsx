import { cn } from "@/lib/utils";

type TaskProgressBarProps = {
    completed: number;
    total: number;
    className?: string;
    barClassName?: string;
    label?: string;
    tone?: "accent" | "muted";
};

export function TaskProgressBar({
    completed,
    total,
    className,
    barClassName,
    label = "Requisitos",
    tone = "accent",
}: TaskProgressBarProps) {
    const percentage = total > 0
        ? Math.min(100, Math.round((completed / total) * 100))
        : 0;

    return (
        <div
            className={cn("flex min-w-0 items-center gap-2", className)}
            aria-label={`${label}: ${completed} de ${total}`}
        >
            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                {label} {completed}/{total}
            </span>
            <div
                className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-300/70"
                aria-hidden="true"
            >
                <div
                    className={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        barClassName || (tone === "accent" ? "bg-accent" : "bg-[var(--text-muted)]"),
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="shrink-0 text-[9px] font-bold tabular-nums text-[var(--text-muted)]">
                {percentage}%
            </span>
        </div>
    );
}
