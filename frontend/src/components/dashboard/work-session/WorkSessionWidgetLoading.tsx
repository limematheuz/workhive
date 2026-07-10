"use client";

interface WorkSessionWidgetLoadingProps {
    loadingLabel: string;
}

export function WorkSessionWidgetLoading({ loadingLabel }: WorkSessionWidgetLoadingProps) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm flex items-center justify-center min-h-[220px]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-[var(--text-muted)]">{loadingLabel}</span>
            </div>
        </div>
    );
}
