"use client";

import { CalendarDays } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import type { Dictionary } from "@/lib/dictionary-context";
import type { CalendarConnectionStatus } from "@/services/calendar.service";
import { CalendarGoogleControls } from "./CalendarGoogleControls";
import { CalendarOwnershipRequests } from "./CalendarOwnershipRequests";

type CalendarHeaderProps = {
    calendarDict: Dictionary["calendar"];
    status: CalendarConnectionStatus | null;
    loading: boolean;
    connecting: boolean;
    syncing: boolean;
    disconnecting: boolean;
    requestingOwnership: boolean;
    reviewingRequestId: number | null;
    lastError: string | null | undefined;
    onConnect: () => void;
    onSync: () => void;
    onDisconnectRequest: () => void;
    onRequestOwnership: () => void;
    onReviewOwnership: (
        requestId: number,
        decision: "approve" | "reject",
    ) => void;
};

export function CalendarHeader({
    calendarDict,
    status,
    loading,
    connecting,
    syncing,
    disconnecting,
    requestingOwnership,
    reviewingRequestId,
    lastError,
    onConnect,
    onSync,
    onDisconnectRequest,
    onRequestOwnership,
    onReviewOwnership,
}: CalendarHeaderProps) {
    return (
        <section className="space-y-4">
            <PageHeader
                icon={CalendarDays}
                title={calendarDict.title}
                subtitle={calendarDict.subtitle}
                actions={(
                    <CalendarGoogleControls
                        status={status}
                        loading={loading}
                        connecting={connecting}
                        syncing={syncing}
                        disconnecting={disconnecting}
                        requestingOwnership={requestingOwnership}
                        calendarDict={calendarDict}
                        onConnect={onConnect}
                        onSync={onSync}
                        onDisconnectRequest={onDisconnectRequest}
                        onRequestOwnership={onRequestOwnership}
                    />
                )}
            />
            {lastError && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{lastError}</p>
            )}
            {status?.is_owner && (
                <CalendarOwnershipRequests
                    calendarDict={calendarDict}
                    connected={status.connected}
                    requests={status.pending_ownership_requests}
                    reviewingRequestId={reviewingRequestId}
                    onReview={onReviewOwnership}
                />
            )}
        </section>
    );
}
