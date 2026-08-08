"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Building2, Loader2, Search, Users } from "lucide-react";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { WorkSessionService } from "@/services/work-session.service";
import type { ActiveCompanySession } from "@/types/user";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { LiveWorkStatsCards } from "@/components/dashboard/live-work/LiveWorkStatsCards";
import { LiveWorkSessionList } from "@/components/dashboard/live-work/LiveWorkSessionList";

export default function LiveWorkPage() {
    const { user, loading: userLoading } = useUser();
    const { dict, locale } = useDictionary();
    const [sessions, setSessions] = useState<ActiveCompanySession[]>([]);
    const [activeScope, setActiveScope] = useState<"own" | "collaborator">("own");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());

    const canView = ["admin", "manager", "superadmin"].includes(
        user?.role?.name || ""
    );

    const loadSessions = useCallback(async (showLoader = false) => {
        if (!canView) return;
        if (showLoader) setLoading(true);
        try {
            const activeSessions = await WorkSessionService.getActiveCompanySessions();
            setSessions(activeSessions);
            setLastUpdatedAt(Date.now());
            setError(null);
        } catch {
            setError(
                dict.work_sessions?.live_error
                || "No se pudieron cargar los fichajes activos."
            );
        } finally {
            setLoading(false);
        }
    }, [canView, dict.work_sessions?.live_error]);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => {
            if (canView) {
                void loadSessions(true);
            } else if (!userLoading) {
                setLoading(false);
            }
        }, 0);
        return () => window.clearTimeout(initialLoad);
    }, [canView, loadSessions, userLoading]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useBackgroundPolling(
        () => loadSessions(false),
        POLL_INTERVALS.liveWork,
    );

    const scopedSessions = useMemo(
        () => sessions.filter(session => session.visibility_scope === activeScope),
        [activeScope, sessions]
    );

    const visibleSessions = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return scopedSessions;
        return scopedSessions.filter(session =>
            [
                session.user_name,
                session.user_email,
                session.worker_company_name,
                session.location_name,
                session.task_title || "",
            ].some(value => value.toLocaleLowerCase().includes(normalizedQuery))
        );
    }, [query, scopedSessions]);

    const locationCount = useMemo(
        () => new Set(scopedSessions.map(session => session.location_id)).size,
        [scopedSessions]
    );
    const ownCount = sessions.filter(session => session.visibility_scope === "own").length;
    const collaboratorCount = sessions.filter(
        session => session.visibility_scope === "collaborator"
    ).length;

    const sessionsByCompany = useMemo(() => {
        const grouped = new Map<number, {
            companyName: string;
            sessions: ActiveCompanySession[];
        }>();
        for (const session of visibleSessions) {
            const group = grouped.get(session.worker_company_id);
            if (group) {
                group.sessions.push(session);
            } else {
                grouped.set(session.worker_company_id, {
                    companyName: session.worker_company_name,
                    sessions: [session],
                });
            }
        }
        return [...grouped.entries()]
            .sort(([, first], [, second]) =>
                first.companyName.localeCompare(second.companyName, locale)
            );
    }, [locale, visibleSessions]);

    if (userLoading || loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="dashboard-page-content px-[3%] py-6 md:p-8">
                <div className="billing-block rounded-2xl border border-[var(--border-soft)] px-5 py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                    <h2 className="mt-4 text-lg font-bold text-[var(--text-main)]">
                        {dict.work_sessions?.live_restricted || "Vista reservada a responsables de equipo"}
                    </h2>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Activity}
                title={dict.work_sessions?.live_title || "Fichajes en vivo"}
                subtitle={
                    dict.work_sessions?.live_description
                    || "Consulta quién está trabajando, en qué tarea y desde qué ubicación inició su jornada."
                }
                className="mb-6"
                actions={(
                    <div className="relative w-full sm:w-72 xl:w-80">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        <Input
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder={dict.work_sessions?.live_search || "Buscar trabajador, tarea o ubicación..."}
                            aria-label={dict.work_sessions?.live_search || "Buscar trabajador, tarea o ubicación..."}
                            className="h-9 rounded-xl border-[var(--border-soft)] bg-[var(--bg-primary)] pl-10 text-sm font-medium text-[var(--text-main)] shadow-none placeholder:text-[var(--text-muted)] focus-visible:border-accent/50"
                        />
                    </div>
                )}
            />

            <section className="billing-surface relative overflow-hidden rounded-[24px] p-4 sm:p-5">
                <div className="space-y-4">
                    <LiveWorkStatsCards
                        workerCount={scopedSessions.length}
                        locationCount={locationCount}
                        lastUpdatedAt={lastUpdatedAt}
                    />

                    {error && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600">
                            {error}
                        </div>
                    )}

                    <PremiumTabs
                        layout="fit"
                        tabs={[
                            {
                                id: "own",
                                label: dict.work_sessions?.live_tab_own
                                    || (locale === "es" ? "Equipo propio" : "Own team"),
                                icon: Users,
                                badge: ownCount,
                            },
                            {
                                id: "collaborator",
                                label: dict.work_sessions?.live_tab_collaborator
                                    || (locale === "es"
                                        ? "Empresas colaboradoras"
                                        : "Partner companies"),
                                icon: Building2,
                                badge: collaboratorCount,
                            },
                        ]}
                        activeTab={activeScope}
                        onChange={setActiveScope}
                    />

                    <LiveWorkSessionList
                        query={query}
                        activeScope={activeScope}
                        sessionsByCompany={sessionsByCompany}
                        visibleCount={visibleSessions.length}
                        now={now}
                    />
                </div>
            </section>
        </div>
    );
}
