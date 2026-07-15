"use client";

import { useDictionary } from "@/lib/dictionary-context";

type LiveWorkStatsCardsProps = {
    workerCount: number;
    locationCount: number;
    lastUpdatedAt: number;
};

export function LiveWorkStatsCards({
    workerCount,
    locationCount,
    lastUpdatedAt,
}: LiveWorkStatsCardsProps) {
    const { dict, locale } = useDictionary();

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="surface-glass-card rounded-3xl p-5">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.work_sessions?.live_workers || "Trabajadores activos"}
                </p>
                <p className="mt-2 text-3xl font-black text-[var(--text-main)]">{workerCount}</p>
            </div>
            <div className="surface-glass-card rounded-3xl p-5">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.work_sessions?.live_locations || "Ubicaciones activas"}
                </p>
                <p className="mt-2 text-3xl font-black text-[var(--text-main)]">{locationCount}</p>
            </div>
            <div className="surface-glass-card rounded-3xl p-5 sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.work_sessions?.last_update || "Última actualización"}
                </p>
                <p className="mt-2 text-lg font-black text-[var(--text-main)]">
                    {new Date(lastUpdatedAt).toLocaleTimeString(
                        locale === "es" ? "es-ES" : "en-US",
                        { timeZone: "UTC" },
                    )}
                </p>
            </div>
        </div>
    );
}
