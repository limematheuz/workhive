"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import { toast } from "@/lib/toast";
import {
    CalendarService,
    type CalendarConnectionStatus,
} from "@/services/calendar.service";

interface ConnectionMessages {
    connectedSuccess: string;
    connectionError: string;
    disconnectedSuccess: string;
    disconnectError: string;
    syncError: string;
    syncSuccess: string;
    unconfigured: string;
}

interface ConnectionOptions {
    canManage: boolean;
    messages: ConnectionMessages;
    onTasksChanged: () => Promise<void> | void;
}

export function useGoogleCalendarConnection({
    canManage,
    messages,
    onTasksChanged,
}: ConnectionOptions) {
    const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!canManage) {
            setLoading(false);
            return;
        }
        try {
            setStatus(await CalendarService.getStatus());
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }, [canManage]);

    useEffect(() => {
        startTransition(() => {
            void loadStatus();
        });
    }, [loadStatus]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const result = params.get("calendar");
        if (result === "connected") {
            toast.success(messages.connectedSuccess);
            window.history.replaceState({}, "", window.location.pathname);
            startTransition(() => {
                void loadStatus();
            });
        } else if (result === "error") {
            toast.error(messages.connectionError);
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [loadStatus, messages.connectedSuccess, messages.connectionError]);

    const connect = async () => {
        if (!canManage) return;
        if (status && (!status.enabled || !status.configured)) {
            toast.error(messages.unconfigured);
            return;
        }
        setConnecting(true);
        try {
            await CalendarService.connectGoogle();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : messages.connectionError,
            );
            setConnecting(false);
        }
    };

    const sync = async () => {
        if (!canManage) return;
        setSyncing(true);
        try {
            const result = await CalendarService.sync();
            toast.success(
                messages.syncSuccess
                    .replace("{imported}", String(result.imported))
                    .replace("{exported}", String(result.exported)),
            );
            await onTasksChanged();
            await loadStatus();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : messages.syncError);
        } finally {
            setSyncing(false);
        }
    };

    const disconnect = async () => {
        if (!canManage) return;
        setDisconnecting(true);
        try {
            await CalendarService.disconnectGoogle();
            toast.success(messages.disconnectedSuccess);
            await loadStatus();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : messages.disconnectError,
            );
        } finally {
            setDisconnecting(false);
        }
    };

    return {
        connect,
        connecting,
        disconnect,
        disconnecting,
        loadStatus,
        loading,
        status,
        sync,
        syncing,
    };
}
