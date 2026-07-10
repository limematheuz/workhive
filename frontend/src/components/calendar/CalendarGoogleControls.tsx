"use client";

import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import type { CalendarConnectionStatus } from "@/services/calendar.service";

interface CalendarGoogleControlsProps {
    canConnect: boolean;
    status: CalendarConnectionStatus | null;
    loading: boolean;
    connecting: boolean;
    syncing: boolean;
    disconnecting: boolean;
    calendarDict: Dictionary["calendar"];
    onConnect: () => void;
    onSync: () => void;
    onDisconnectRequest: () => void;
}

export function CalendarGoogleControls({
    canConnect,
    status,
    loading,
    connecting,
    syncing,
    disconnecting,
    calendarDict,
    onConnect,
    onSync,
    onDisconnectRequest,
}: CalendarGoogleControlsProps) {
    if (!canConnect) return null;

    if (loading) {
        return <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />;
    }

    if (!status?.connected) {
        return (
            <Button
                onClick={onConnect}
                disabled={connecting || loading}
                className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {connecting ? <Loader2 className="animate-spin" /> : <Cloud />}
                {calendarDict.connect_google}
            </Button>
        );
    }

    return (
        <>
            <span className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--dialog-control-bg)] px-3 py-2 text-xs font-bold text-[var(--text-main)]">
                <Cloud className="h-4 w-4" />
                {status.google_account_email || status.calendar_name}
            </span>
            <Button
                onClick={onSync}
                disabled={syncing}
                className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {calendarDict.sync_now}
            </Button>
            <Button
                onClick={onDisconnectRequest}
                disabled={disconnecting}
                className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {disconnecting ? <Loader2 className="animate-spin" /> : <CloudOff />}
                {calendarDict.disconnect}
            </Button>
        </>
    );
}
