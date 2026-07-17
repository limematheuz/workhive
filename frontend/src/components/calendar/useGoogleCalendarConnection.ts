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
    ownershipRequested: string;
    ownershipRequestError: string;
    ownershipApproved: string;
    ownershipRejected: string;
}

interface ConnectionOptions {
    canLoadStatus: boolean;
    messages: ConnectionMessages;
    onTasksChanged: () => Promise<void> | void;
}

export function useGoogleCalendarConnection({
    canLoadStatus,
    messages,
    onTasksChanged,
}: ConnectionOptions) {
    const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [requestingOwnership, setRequestingOwnership] = useState(false);
    const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null);

    const loadStatus = useCallback(async () => {
        if (!canLoadStatus) {
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
    }, [canLoadStatus]);

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
        if (!status?.can_connect) return;
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
        if (!status?.can_sync) return;
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
        if (!status?.can_disconnect) return;
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

    const requestOwnership = async () => {
        if (!status?.can_request_ownership) return;
        setRequestingOwnership(true);
        try {
            await CalendarService.requestOwnership();
            toast.success(messages.ownershipRequested);
            await loadStatus();
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : messages.ownershipRequestError,
            );
        } finally {
            setRequestingOwnership(false);
        }
    };

    const reviewOwnership = async (
        requestId: number,
        decision: "approve" | "reject",
    ) => {
        if (!status?.is_owner) return;
        setReviewingRequestId(requestId);
        try {
            await CalendarService.reviewOwnership(requestId, decision);
            toast.success(
                decision === "approve"
                    ? messages.ownershipApproved
                    : messages.ownershipRejected,
            );
            await loadStatus();
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : messages.ownershipRequestError,
            );
        } finally {
            setReviewingRequestId(null);
        }
    };

    return {
        connect,
        connecting,
        disconnect,
        disconnecting,
        loadStatus,
        loading,
        requestOwnership,
        requestingOwnership,
        reviewOwnership,
        reviewingRequestId,
        status,
        sync,
        syncing,
    };
}
