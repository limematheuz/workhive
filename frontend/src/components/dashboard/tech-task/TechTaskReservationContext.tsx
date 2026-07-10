"use client";

import React from "react";
import { Calendar, Key, ChevronUp, ChevronDown, Users } from "lucide-react";
import { TaskItem } from "@/types/user";
import { formatShortDateTime, formatStayType } from "./utils";
import { useDictionary } from "@/lib/dictionary-context";

interface TechTaskReservationContextProps {
    task: TaskItem;
    locale: string;
    checkoutDate: string | null;
    nextCheckInDate: string | null;
    expandedReservation: "checkout" | "next" | null;
    setExpandedReservation: React.Dispatch<React.SetStateAction<"checkout" | "next" | null>>;
}

export function TechTaskReservationContext({
    task,
    locale,
    checkoutDate,
    nextCheckInDate,
    expandedReservation,
    setExpandedReservation,
}: TechTaskReservationContextProps) {
    const { dict } = useDictionary();

    return (
        <div className="space-y-2">
            <h3 className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                {dict.tech?.booking_info || "Booking Info"}
            </h3>

            {task.checkout_reservation ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)]">
                    <button
                        type="button"
                        onClick={() => setExpandedReservation(value => value === "checkout" ? null : "checkout")}
                        className="flex w-full items-center justify-between bg-[var(--bg-card)] p-3.5 text-left transition-colors hover:bg-[var(--bg-primary)]/10"
                    >
                        <div className="flex items-center gap-3">
                            <Key className="h-5 w-5 text-[var(--text-muted)]" />
                            <div>
                                <p className="text-xs font-bold text-[var(--text-main)]">
                                    {(dict.tech?.current_checkout || "Current check-out")} · {checkoutDate}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-[10px] font-bold text-[var(--text-muted)]">
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {task.checkout_reservation.guest_count} {dict.tech?.guests_label || "guests"}
                                    </span>
                                    <span>
                                        {dict.tech?.checkin_label || "Check-in"}{" "}
                                        {formatShortDateTime(task.checkout_reservation.check_in_at, locale)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {expandedReservation === "checkout"
                            ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                            : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
                    </button>
                    {expandedReservation === "checkout" && (
                        <div className="space-y-2 border-t border-[var(--border-soft)] bg-[var(--bg-primary)]/5 p-4 text-xs">
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--text-muted)]">{dict.tech?.stay_label || "Stay"}</span>
                                <span className="font-bold text-[var(--text-main)]">
                                    {formatShortDateTime(task.checkout_reservation.check_in_at, locale)} – {checkoutDate}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--text-muted)]">{dict.tech?.type_label || "Type"}</span>
                                <span className="font-bold text-[var(--text-main)]">
                                    {formatStayType(task.checkout_reservation.stay_type, locale, dict)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/5 p-4 text-xs font-semibold text-[var(--text-muted)]">
                    {dict.tech?.not_linked_checkout || "This task is not linked to a check-out."}
                </div>
            )}

            {task.next_reservation ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)]">
                    <button
                        type="button"
                        onClick={() => setExpandedReservation(value => value === "next" ? null : "next")}
                        className="flex w-full items-center justify-between bg-[var(--bg-card)] p-3.5 text-left transition-colors hover:bg-[var(--bg-primary)]/10"
                    >
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
                            <div>
                                <p className="text-xs font-bold text-[var(--text-main)]">
                                    {dict.tech?.next_checkin || "Next check-in"} · {nextCheckInDate}
                                </p>
                                <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
                                    <Users className="h-3.5 w-3.5" />
                                    {task.next_reservation.guest_count} {dict.tech?.guests_label || "guests"}
                                </span>
                            </div>
                        </div>
                        {expandedReservation === "next"
                            ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                            : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
                    </button>
                    {expandedReservation === "next" && (
                        <div className="space-y-2 border-t border-[var(--border-soft)] bg-[var(--bg-primary)]/5 p-4 text-xs">
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--text-muted)]">{dict.tech?.stay_label || "Stay"}</span>
                                <span className="font-bold text-[var(--text-main)]">
                                    {nextCheckInDate} – {formatShortDateTime(task.next_reservation.check_out_at, locale)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--text-muted)]">{dict.tech?.type_label || "Type"}</span>
                                <span className="font-bold text-[var(--text-main)]">
                                    {formatStayType(task.next_reservation.stay_type, locale, dict)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-primary)]/5 p-4">
                    <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {dict.tech?.no_linked_next_checkin || "There is no linked next check-in."}
                    </p>
                </div>
            )}
        </div>
    );
}
