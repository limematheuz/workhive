"use client";

import { CalendarDays } from "lucide-react";

import { BrandIconWell } from "@/components/ui/brand-icon-well";
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
        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                    <BrandIconWell icon={CalendarDays} size="lg" iconClassName="h-6 w-6" />
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-[var(--text-main)]">{calendarDict.title}</h1>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{calendarDict.subtitle}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                </div>
            </div>
            {lastError && (
                <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600">{lastError}</p>
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
