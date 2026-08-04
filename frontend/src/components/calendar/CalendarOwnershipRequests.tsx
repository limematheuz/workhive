"use client";

import { Check, Loader2, UserRoundCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import type { CalendarOwnershipRequest } from "@/services/calendar.service";

type CalendarOwnershipRequestsProps = {
    calendarDict: Dictionary["calendar"];
    connected: boolean;
    requests: CalendarOwnershipRequest[];
    reviewingRequestId: number | null;
    onReview: (requestId: number, decision: "approve" | "reject") => void;
};

export function CalendarOwnershipRequests({
    calendarDict,
    connected,
    requests,
    reviewingRequestId,
    onReview,
}: CalendarOwnershipRequestsProps) {
    if (!requests.length) return null;

    return (
        <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                <UserRoundCheck className="h-4 w-4 text-accent" />
                {calendarDict.control_requests}
            </div>
            {connected && (
                <p className="mb-3 text-xs text-amber-600">
                    {calendarDict.disconnect_before_transfer}
                </p>
            )}
            <div className="space-y-2">
                {requests.map((request) => (
                    <div
                        key={request.id}
                        className="flex flex-col gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                {request.requester_name || request.requester_email}
                            </p>
                            <p className="truncate text-xs text-[var(--text-muted)]">
                                {request.requester_email}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                disabled={connected || reviewingRequestId !== null}
                                onClick={() => onReview(request.id, "approve")}
                            >
                                {reviewingRequestId === request.id
                                    ? <Loader2 className="animate-spin" />
                                    : <Check />}
                                {calendarDict.approve}
                            </Button>
                            <Button
                                type="button"
                                variant="dangerSoft"
                                disabled={reviewingRequestId !== null}
                                onClick={() => onReview(request.id, "reject")}
                            >
                                <X />
                                {calendarDict.reject}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
