"use client";

import { useSyncExternalStore } from "react";

import {
    Calendar,
    CalendarDays,
    Edit3,
    Flag,
    Loader2,
    MapPin,
    XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkStartLocationLink } from "@/components/work-sessions/WorkStartLocationLink";
import type { Dictionary, Locale } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";

import {
    formatReservationDate,
    formatReservationDateTime,
    formatReservationTime,
} from "./reservation-display";
import { hasReservationCheckedOut } from "./reservation-helpers";

const subscribeToTimeZone = () => () => {};
const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimeZone = () => null;

const statusBadgeClass: Record<string, string> = {
    confirmed:
        "border-accent/20 bg-accent/10 text-accent",
    tentative:
        "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    cancelled:
        "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-muted)]",
};

interface ReservationListProps {
    loading: boolean;
    reservations: Reservation[];
    locationMap: Map<number, Location>;
    dict: Dictionary;
    locale: Locale;
    companyId?: number | null;
    onEdit: (reservation: Reservation) => void;
    onCancel: (reservation: Reservation) => void;
}

export function ReservationList({
    loading,
    reservations,
    locationMap,
    dict,
    locale,
    companyId,
    onEdit,
    onCancel,
}: ReservationListProps) {
    const timeZone = useSyncExternalStore(
        subscribeToTimeZone,
        getBrowserTimeZone,
        getServerTimeZone,
    );

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
        );
    }

    if (reservations.length === 0) {
        return (
            <div className="billing-block rounded-2xl border border-dashed border-[var(--border-soft)] px-5 py-14 text-center">
                <CalendarDays className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.reservations?.table?.no_reservations ||
                        "No hay reservas en esta selección"}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {reservations.map((reservation) => (
                <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    location={locationMap.get(reservation.location_id)}
                    dict={dict}
                    locale={locale}
                    timeZone={timeZone}
                    canEdit={reservation.owner_company_id === companyId}
                    onEdit={onEdit}
                    onCancel={onCancel}
                />
            ))}
        </div>
    );
}

interface ReservationCardProps {
    reservation: Reservation;
    location?: Location;
    dict: Dictionary;
    locale: Locale;
    timeZone: string | null;
    canEdit: boolean;
    onEdit: (reservation: Reservation) => void;
    onCancel: (reservation: Reservation) => void;
}

function cleaningStatusLabel(
    status: Reservation["cleaning_status"],
    dict: Dictionary,
): string {
    if (status === "rejected") {
        return (
            dict.reservations?.table?.cleaning_status_rejected || "Rechazada"
        );
    }
    if (status === "requested") {
        return (
            dict.reservations?.table?.cleaning_status_requested || "Solicitada"
        );
    }
    if (status === "completed") {
        return (
            dict.reservations?.table?.cleaning_status_completed || "Completada"
        );
    }
    return (
        dict.reservations?.table?.cleaning_status_assigned || "Asignada"
    );
}

function cleaningStatusClass(status: Reservation["cleaning_status"]): string {
    if (status === "rejected") return "text-[var(--btn-cancel-text)]";
    if (status === "requested") {
        return "text-orange-700 dark:text-orange-300";
    }
    if (status === "completed") return "text-accent";
    return "text-[var(--text-main)]";
}

function ReservationCard({
    reservation,
    location,
    dict,
    locale,
    timeZone,
    canEdit,
    onEdit,
    onCancel,
}: ReservationCardProps) {
    const dateLocale = locale === "en" ? "en-US" : "es-ES";
    const statusClass =
        statusBadgeClass[reservation.status] || statusBadgeClass.confirmed;
    const isFinished = hasReservationCheckedOut(reservation);

    const statusLabel =
        reservation.status === "confirmed"
            ? dict.reservations?.table?.confirmed || "confirmada"
            : reservation.status === "tentative"
              ? dict.reservations?.table?.tentative || "tentativa"
              : dict.reservations?.table?.cancelled || "cancelada";

    return (
        <article
            className={cn(
                "billing-block group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-soft)] p-4 transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-[0_8px_20px_rgba(52,74,94,0.08)]",
                reservation.status === "cancelled" && "opacity-60",
            )}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2.5 text-[10px] font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Calendar className="h-3.5 w-3.5 text-accent" />
                        <span>
                            {formatReservationDate(
                                reservation.check_in_at,
                                dateLocale,
                                timeZone,
                                true,
                            ).toUpperCase()}
                            {" – "}
                            {formatReservationDate(
                                reservation.check_out_at,
                                dateLocale,
                                timeZone,
                                true,
                            ).toUpperCase()}
                        </span>
                    </div>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            statusClass,
                        )}
                    >
                        {statusLabel}
                    </Badge>
                </div>

                <div className="space-y-1">
                    <h3 className="text-base font-bold text-[var(--text-main)] transition-colors group-hover:text-accent">
                        {location?.name ||
                            `Ubicación #${reservation.location_id}`}
                    </h3>
                    {location?.address ? (
                        <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)]">
                            {location.address}
                        </p>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold text-[var(--text-main)]">
                        {reservation.stay_type === "guest"
                            ? dict.reservations?.table?.guest_stay ||
                              "Estancia de Huéspedes"
                            : reservation.stay_type === "owner"
                              ? dict.reservations?.table?.owner_stay ||
                                "Estancia de Propietario"
                              : dict.reservations?.table?.blocked_stay ||
                                "Bloqueo de Calendario"}
                        {` · ${reservation.guest_count} ${
                            reservation.guest_count === 1
                                ? dict.reservations?.table?.guest_single ||
                                  "Huésped"
                                : dict.reservations?.table?.guests_plural ||
                                  "Huéspedes"
                        }`}
                    </p>
                    {reservation.notes ? (
                        <p className="mt-1 text-[11px] font-medium italic leading-normal text-[var(--text-muted)]">
                            &ldquo;{reservation.notes}&rdquo;
                        </p>
                    ) : null}
                </div>

                {reservation.cleaning_required ? (
                    <>
                        <div className="mt-1 grid grid-cols-1 divide-y divide-[var(--border-soft)] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-3 py-2.5">
                                <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                    {dict.reservations?.table?.col_provider ||
                                        "Proveedor"}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--text-main)]">
                                    {reservation.assigned_company_name ||
                                        dict.reservations?.filters
                                            ?.internal_management ||
                                        "Interna"}
                                </span>
                            </div>
                            <div className="px-3 py-2.5">
                                <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                    {dict.reservations?.table
                                        ?.col_cleaning_date || "Fecha Limpieza"}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold text-[var(--text-main)]">
                                    {reservation.cleaning_scheduled_at
                                        ? `${formatReservationDate(
                                              reservation.cleaning_scheduled_at,
                                              dateLocale,
                                              timeZone,
                                          )} ${formatReservationTime(
                                              reservation.cleaning_scheduled_at,
                                              dateLocale,
                                              timeZone,
                                          )}`
                                        : "—"}
                                </span>
                            </div>
                            <div className="px-3 py-2.5">
                                <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                    {dict.reservations?.table
                                        ?.col_cleaning_status ||
                                        "Estado Limpieza"}
                                </span>
                                <span
                                    className={cn(
                                        "mt-0.5 block text-[11px] font-semibold",
                                        cleaningStatusClass(
                                            reservation.cleaning_status,
                                        ),
                                    )}
                                >
                                    {cleaningStatusLabel(
                                        reservation.cleaning_status,
                                        dict,
                                    )}
                                </span>
                            </div>
                        </div>
                        {reservation.cleaning_start_locations &&
                        reservation.cleaning_start_locations.length > 0 ? (
                            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30 px-3 py-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                    {dict.reservations?.table
                                        ?.work_start_locations ||
                                        "Ubicación al iniciar el fichaje"}
                                </p>
                                <div className="mt-1.5 flex flex-col gap-1 text-xs">
                                    {reservation.cleaning_start_locations.map(
                                        (startLocation) => (
                                            <WorkStartLocationLink
                                                key={startLocation.session_id}
                                                latitude={
                                                    startLocation.latitude
                                                }
                                                longitude={
                                                    startLocation.longitude
                                                }
                                                accuracyMeters={
                                                    startLocation.accuracy_meters
                                                }
                                                label={`${startLocation.user_name} · ${formatReservationDateTime(
                                                    startLocation.started_at,
                                                    dateLocale,
                                                    timeZone,
                                                )}`}
                                            />
                                        ),
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm">
                        <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-secondary-bg)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--btn-secondary-text)]">
                        <span>
                            {`${
                                dict.reservations?.table?.check_in_short ||
                                "ENTRADA"
                            } ${formatReservationTime(
                                reservation.check_in_at,
                                dateLocale,
                                timeZone,
                            )} / ${
                                dict.reservations?.table?.check_out_short ||
                                "SALIDA"
                            } ${formatReservationTime(
                                reservation.check_out_at,
                                dateLocale,
                                timeZone,
                            )}`}
                        </span>
                        <Flag className="ml-0.5 h-3.5 w-3.5 text-[var(--btn-secondary-text)]/70" />
                    </div>
                </div>

                <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                >
                    {canEdit && reservation.status !== "cancelled" ? (
                        <>
                            <Button
                                size="xs"
                                variant="secondary"
                                disabled={isFinished}
                                onClick={() => onEdit(reservation)}
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                                {dict.reservations?.table?.btn_edit || "Editar"}
                            </Button>
                            <Button
                                size="xs"
                                variant="dangerSoft"
                                disabled={isFinished}
                                onClick={() => onCancel(reservation)}
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                {dict.reservations?.table?.btn_cancel ||
                                    "Cancelar"}
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
