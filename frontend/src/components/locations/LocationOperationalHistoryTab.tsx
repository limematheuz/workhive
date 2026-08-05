"use client";

import { useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Loader2,
    RefreshCw,
    UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import {
    LocationService,
    type LocationHistoryPeriod,
    type LocationOperationalHistory,
} from "@/services/location.service";

const PAGE_SIZE = 10;

const PERIODS: Array<{ id: LocationHistoryPeriod; label: string }> = [
    { id: "day", label: "Día" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
];

function localDateInputValue(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return "< 1 min";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function formatMoment(value: string): string {
    return new Date(value).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface LocationOperationalHistoryTabProps {
    locationId: number;
    open: boolean;
}

interface PaginationControlsProps {
    currentPage: number;
    total: number;
    onChange: (page: number) => void;
}

function PaginationControls({ currentPage, total, onChange }: PaginationControlsProps) {
    const pageCount = Math.ceil(total / PAGE_SIZE);
    if (pageCount <= 1) return null;

    return (
        <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">
                Página {currentPage + 1} de {pageCount}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === 0}
                    onClick={() => onChange(currentPage - 1)}
                    aria-label="Página anterior"
                    className="h-8 w-8 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => onChange(currentPage + 1)}
                    aria-label="Página siguiente"
                    className="h-8 w-8 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function EmptyHistory({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/20 p-5 text-center text-xs font-semibold text-[var(--text-muted)]">
            {label}
        </div>
    );
}

/** Read-only audit of completed work and closed clock-ins for this location. */
export function LocationOperationalHistoryTab({ locationId, open }: LocationOperationalHistoryTabProps) {
    const [period, setPeriod] = useState<LocationHistoryPeriod>("week");
    const [anchorDate, setAnchorDate] = useState(() => localDateInputValue());
    const [completedPage, setCompletedPage] = useState(0);
    const [sessionsPage, setSessionsPage] = useState(0);
    const [history, setHistory] = useState<LocationOperationalHistory | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            setHistory(await LocationService.getOperationalHistory(locationId, period, anchorDate, {
                completedOffset: completedPage * PAGE_SIZE,
                sessionsOffset: sessionsPage * PAGE_SIZE,
                limit: PAGE_SIZE,
            }));
        } catch {
            setError("No se pudo cargar el historial operativo de esta ubicación.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadHistory();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    // Loading is intentionally retriggered only by the visible filter/page state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId, open, period, anchorDate, completedPage, sessionsPage]);

    const dateLabel = useMemo(() => new Date(`${anchorDate}T12:00:00`).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }), [anchorDate]);

    const resetPages = () => {
        setCompletedPage(0);
        setSessionsPage(0);
    };

    return (
        <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-black text-[var(--text-main)]">Historial de actividad</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        Tareas finalizadas y fichajes cerrados de la ubicación. Solo consulta.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void loadHistory()}
                    disabled={loading}
                    className="h-9 w-9 shrink-0 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-accent hover:bg-accent/10"
                    aria-label="Actualizar historial de actividad"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/25 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-1.5">
                    <span className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Periodo</span>
                    <PremiumTabs
                        tabs={PERIODS.map((item) => ({ id: item.id, label: item.label }))}
                        activeTab={period}
                        onChange={(nextPeriod) => {
                            setPeriod(nextPeriod);
                            resetPages();
                        }}
                    />
                </div>
                <label className="block space-y-1.5">
                    <span className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Fecha</span>
                    <input
                        type="date"
                        value={anchorDate}
                        onChange={(event) => {
                            setAnchorDate(event.target.value);
                            resetPages();
                        }}
                        aria-label="Fecha del historial"
                        className="h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm font-bold text-[var(--text-main)] outline-none focus:border-accent"
                    />
                </label>
            </div>

            {loading && !history ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs font-semibold text-[var(--text-muted)]">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" /> Cargando historial…
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 text-sm font-semibold text-[var(--btn-cancel-text)]">
                    {error}
                </div>
            ) : history ? (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 p-3.5">
                            <span className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Finalizadas
                            </span>
                            <strong className="mt-1 block text-xl font-black text-[var(--text-main)]">{history.completed_task_count}</strong>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/35 p-3.5">
                            <span className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                                <Clock3 className="h-3.5 w-3.5 text-accent" /> Tiempo fichado
                            </span>
                            <strong className="mt-1 block text-xl font-black text-[var(--text-main)]">{formatDuration(history.worked_seconds)}</strong>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Tareas finalizadas</h4>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">{history.completed_task_total}</span>
                        </div>
                        {history.completed_tasks.length ? history.completed_tasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/30 p-3">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[var(--text-main)]">{task.title}</p>
                                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Finalizada {formatMoment(task.completed_at)}</p>
                                </div>
                            </div>
                        )) : (
                            <EmptyHistory label={`No hay tareas finalizadas para ${dateLabel}.`} />
                        )}
                        <PaginationControls
                            currentPage={completedPage}
                            total={history.completed_task_total}
                            onChange={setCompletedPage}
                        />
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">Fichajes cerrados</h4>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">{history.session_total}</span>
                        </div>
                        {history.sessions.length ? history.sessions.map((session) => (
                            <div key={session.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/30 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-[var(--text-main)]">{session.task_title || "Trabajo sin título"}</p>
                                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                                            <UserRound className="h-3.5 w-3.5" /> {session.user_name}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-lg border border-accent/20 bg-accent/10 px-2 py-1 text-xs font-black text-accent">
                                        {formatDuration(session.worked_seconds)}
                                    </span>
                                </div>
                                <p className="mt-2 text-2xs font-medium text-[var(--text-muted)]">
                                    {formatMoment(session.started_at)} — {formatMoment(session.ended_at)}
                                </p>
                            </div>
                        )) : (
                            <EmptyHistory label={`No hay fichajes cerrados para ${dateLabel}.`} />
                        )}
                        <PaginationControls
                            currentPage={sessionsPage}
                            total={history.session_total}
                            onChange={setSessionsPage}
                        />
                    </div>
                </>
            ) : null}
        </section>
    );
}
