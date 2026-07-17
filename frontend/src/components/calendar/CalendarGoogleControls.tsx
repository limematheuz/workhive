"use client";

import { Cloud, CloudOff, Loader2, RefreshCw, ShieldQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandIconWell } from "@/components/ui/brand-icon-well";
import type { Dictionary } from "@/lib/dictionary-context";
import type { CalendarConnectionStatus } from "@/services/calendar.service";

interface CalendarGoogleControlsProps {
    status: CalendarConnectionStatus | null;
    loading: boolean;
    connecting: boolean;
    syncing: boolean;
    disconnecting: boolean;
    requestingOwnership: boolean;
    calendarDict: Dictionary["calendar"];
    onConnect: () => void;
    onSync: () => void;
    onDisconnectRequest: () => void;
    onRequestOwnership: () => void;
}

export function CalendarGoogleControls({
    status,
    loading,
    connecting,
    syncing,
    disconnecting,
    requestingOwnership,
    calendarDict,
    onConnect,
    onSync,
    onDisconnectRequest,
    onRequestOwnership,
}: CalendarGoogleControlsProps) {
    if (loading) {
        return <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />;
    }

    if (!status) return null;

    if (!status.connected) {
        return (
            <>
                <span className="text-xs text-[var(--text-muted)]">
                    {calendarDict.primary_admin}: {status.owner_name || status.owner_email}
                </span>
                {status.can_connect && (
                    <Button onClick={onConnect} disabled={connecting || loading} size="sm">
                        {connecting ? <Loader2 className="animate-spin" /> : <Cloud />}
                        {calendarDict.connect_google}
                    </Button>
                )}
                {status.can_request_ownership && (
                    <Button
                        onClick={onRequestOwnership}
                        disabled={requestingOwnership}
                        variant="outline"
                        size="sm"
                    >
                        {requestingOwnership
                            ? <Loader2 className="animate-spin" />
                            : <ShieldQuestion />}
                        {calendarDict.request_control}
                    </Button>
                )}
                {status.ownership_request_status === "pending" && (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600">
                        {calendarDict.request_pending}
                    </span>
                )}
            </>
        );
    }

    return (
        <>
            <span className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--dialog-control-bg)] px-3 py-2 text-xs font-bold text-[var(--text-main)]">
                <BrandIconWell icon={Cloud} size="sm" />
                {status.google_account_email || status.calendar_name}
            </span>
            {status.can_sync && (
                <Button onClick={onSync} disabled={syncing} size="sm">
                    {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    {calendarDict.sync_now}
                </Button>
            )}
            {status.can_disconnect && (
                <Button
                    onClick={onDisconnectRequest}
                    disabled={disconnecting}
                    variant="outline"
                    size="sm"
                >
                    {disconnecting ? <Loader2 className="animate-spin" /> : <CloudOff />}
                    {calendarDict.disconnect}
                </Button>
            )}
            {status.can_request_ownership && (
                <Button
                    onClick={onRequestOwnership}
                    disabled={requestingOwnership}
                    variant="outline"
                    size="sm"
                >
                    {requestingOwnership
                        ? <Loader2 className="animate-spin" />
                        : <ShieldQuestion />}
                    {calendarDict.request_control}
                </Button>
            )}
        </>
    );
}
