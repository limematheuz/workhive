"use client";

import { CalendarDays } from "lucide-react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { CalendarConnectionStatus } from "@/services/calendar.service";
import { CalendarGoogleControls } from "./CalendarGoogleControls";

type CalendarHeaderProps = {
    calendarDict: Dictionary["calendar"];
    canConnect: boolean;
    status: CalendarConnectionStatus | null;
    loading: boolean;
    connecting: boolean;
    syncing: boolean;
    disconnecting: boolean;
    lastError: string | null | undefined;
    onConnect: () => void;
    onSync: () => void;
    onDisconnectRequest: () => void;
};

export function CalendarHeader({
    calendarDict,
    canConnect,
    status,
    loading,
    connecting,
    syncing,
    disconnecting,
    lastError,
    onConnect,
    onSync,
    onDisconnectRequest,
}: CalendarHeaderProps) {
    return (
        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                        <CalendarDays className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-[var(--text-main)]">{calendarDict.title}</h1>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{calendarDict.subtitle}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <CalendarGoogleControls
                        canConnect={canConnect}
                        status={status}
                        loading={loading}
                        connecting={connecting}
                        syncing={syncing}
                        disconnecting={disconnecting}
                        calendarDict={calendarDict}
                        onConnect={onConnect}
                        onSync={onSync}
                        onDisconnectRequest={onDisconnectRequest}
                    />
                </div>
            </div>
            {lastError && (
                <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{lastError}</p>
            )}
        </section>
    );
}
