"use client";

import React from "react";
import { BellRing, MapPin, ShieldAlert } from "lucide-react";
import { TaskItem } from "@/types/user";
import { CompanyCollaboration } from "@/types/collaboration";
import { Reservation } from "@/types/reservation";
import { PrivacyRequest } from "@/services/privacy.service";
import type { Dictionary } from "@/lib/dictionary-context";

interface NotificationItemProps {
    type: "collaboration" | "arrival" | "task" | "task-rejected" | "reservation-cancelled" | "privacy-request";
    data: TaskItem | CompanyCollaboration | Reservation | PrivacyRequest;
    notificationKey: string;
    openingNotificationKey: string | null;
    onClick: () => void;
    dict: Dictionary;
    locale: string;
    locationName?: string;
    previewText?: string;
    linkedArrivalDate?: string | null;
    linkedArrivalGuests?: number;
    timeLabel?: string;
    referenceTime?: number;
}

export function NotificationItem({
    type,
    data,
    notificationKey,
    openingNotificationKey,
    onClick,
    dict,
    locale,
    locationName,
    previewText,
    linkedArrivalDate,
    linkedArrivalGuests,
    timeLabel,
}: NotificationItemProps) {
    const disabled = openingNotificationKey === notificationKey;

    if (type === "collaboration") {
        const collab = data as CompanyCollaboration;
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-3 text-left transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-black text-[var(--text-main)]">
                            {dict.notifications?.types?.link_request || "Solicitud de vinculación"}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            {dict.notifications?.types?.collaboration || "Colaboración"}
                        </p>
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {dict.notifications?.messages?.collab_request ? (
                                dict.notifications.messages.collab_request.split("{name}").map((part: string, idx: number, arr: string[]) => (
                                    <span key={`collab-message-${part || "name-slot"}`}>
                                        {part}
                                        {idx < arr.length - 1 && (
                                            <span className="font-bold text-[var(--text-main)]">
                                                {collab.initiator?.name || "Desconocida"}
                                            </span>
                                        )}
                                    </span>
                                ))
                            ) : (
                                locale === "en" ? (
                                    <>
                                        Company{" "}
                                        <span className="font-bold text-[var(--text-main)]">
                                            {collab.initiator?.name || "Unknown"}
                                        </span>{" "}
                                        wants to collaborate with you.
                                    </>
                                ) : (
                                    <>
                                        La empresa{" "}
                                        <span className="font-bold text-[var(--text-main)]">
                                            {collab.initiator?.name || "Desconocida"}
                                        </span>{" "}
                                        quiere colaborar contigo.
                                    </>
                                )
                            )}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm shadow-red-500/30">
                        {dict.notifications?.messages?.collab_pending || "Pendiente"}
                    </span>
                </div>
            </button>
        );
    }

    if (type === "arrival") {
        const reservation = data as Reservation;
        const arrivalAt = new Date(reservation.check_in_at);
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-accent/20 bg-accent/[0.06] p-3 text-left transition-colors hover:bg-accent/10 disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-black text-[var(--text-main)]">
                            <BellRing className="h-4 w-4 text-accent" />
                            {dict.notifications?.types?.arrival_reminder || "Recordatorio de llegada"}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{locationName}</span>
                        </p>
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {dict.notifications?.messages?.arrival_reminder_desc ? (
                                dict.notifications.messages.arrival_reminder_desc
                                    .replace("{count}", reservation.guest_count.toString())
                                    .replace("{timeLabel}", timeLabel || "")
                                    .replace("{dateStr}", arrivalAt.toLocaleString(locale === "en" ? "en-US" : "es-ES", {
                                        day: "2-digit",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    }))
                            ) : (
                                locale === "en" ? (
                                    <>
                                        Arrival of {reservation.guest_count} guests {timeLabel || ""}, on{" "}
                                        {arrivalAt.toLocaleString("en-US", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}.
                                    </>
                                ) : (
                                    <>
                                        Llegan {reservation.guest_count} huéspedes {timeLabel || ""}, el{" "}
                                        {arrivalAt.toLocaleString("es-ES", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}.
                                    </>
                                )
                            )}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm shadow-red-500/30">
                        {dict.notifications?.types?.incoming || "Próxima"}
                    </span>
                </div>
            </button>
        );
    }

    if (type === "task") {
        const task = data as TaskItem;
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-3 text-left transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{locationName}</span>
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {previewText}
                        </p>
                        {task.status === "requested" && linkedArrivalDate && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-accent">
                                <BellRing className="h-3.5 w-3.5" />
                                {(dict.reservations?.table?.check_in || "Entrada")} el{" "}
                                {linkedArrivalDate} · {linkedArrivalGuests}{" "}
                                {(dict.reservations?.table?.guests || "huéspedes")}
                            </p>
                        )}
                    </div>
                    <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm shadow-red-500/30">
                        {task.status === "requested"
                            ? (dict.notifications?.types?.request || "Solicitud")
                            : (dict.tech?.status_new || "Nueva")}
                    </span>
                </div>
            </button>
        );
    }

    if (type === "task-rejected") {
        const task = data as TaskItem;
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-left transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{locationName}</span>
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {previewText}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-[var(--btn-cancel-border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--btn-cancel-text)]">
                        {dict.notifications?.types?.rejected || "Rechazada"}
                    </span>
                </div>
            </button>
        );
    }

    if (type === "reservation-cancelled") {
        const reservation = data as Reservation;
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-left transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-black text-[var(--text-main)]">
                            {dict.notifications?.types?.reservation_cancelled || "Reserva cancelada"}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{locationName}</span>
                        </p>
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {dict.notifications?.messages?.reservation_cancelled_desc ? (
                                dict.notifications.messages.reservation_cancelled_desc.replace(
                                    "{dateStr}",
                                    new Date(reservation.check_in_at).toLocaleDateString(
                                        locale === "en" ? "en-US" : "es-ES",
                                        { timeZone: "UTC" },
                                    )
                                )
                            ) : (
                                locale === "en" ? (
                                    <>
                                        The reservation checking in on{" "}
                                        {new Date(reservation.check_in_at).toLocaleDateString("en-US", {
                                            timeZone: "UTC",
                                        })} has been
                                        cancelled.
                                    </>
                                ) : (
                                    <>
                                        La reserva con entrada el{" "}
                                        {new Date(reservation.check_in_at).toLocaleDateString("es-ES", {
                                            timeZone: "UTC",
                                        })} ha sido
                                        cancelada.
                                    </>
                                )
                            )}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-[var(--btn-cancel-border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--btn-cancel-text)]">
                        {dict.notifications?.types?.cancelled || "Cancelada"}
                    </span>
                </div>
            </button>
        );
    }

    if (type === "privacy-request") {
        const request = data as PrivacyRequest;
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className="block w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-left transition-colors hover:bg-red-500/15 disabled:opacity-60"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-black text-[var(--text-main)]">
                            <ShieldAlert className="h-4 w-4 text-red-600" />
                            {locale === "en" ? "Account erasure request" : "Solicitud de supresión"}
                        </p>
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                            {locale === "en"
                                ? "A company account requested erasure. Review it from the profile privacy panel."
                                : "Una cuenta de empresa solicitó supresión. Revísala desde el panel de privacidad del perfil."}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm shadow-red-500/30">
                        {request.status}
                    </span>
                </div>
            </button>
        );
    }

    return null;
}
