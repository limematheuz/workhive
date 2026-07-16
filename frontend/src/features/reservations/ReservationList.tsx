"use client";

import {
    Calendar,
    CalendarDays,
    Edit3,
    Flag,
    Loader2,
    MapPin,
    XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkStartLocationLink } from "@/components/work-sessions/WorkStartLocationLink";
import type { Dictionary, Locale } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";

const statusColors: Record<string, string> = {
    confirmed:
        "bg-accent/10 text-accent dark:text-accent border-accent/20",
    tentative:
        "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25",
    cancelled: "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]",
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
    if (loading) {
        return (
            <div className="py-20 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
        );
    }

    if (reservations.length === 0) {
        return (
            <div className="py-20 text-center border border-dashed border-[var(--border-soft)] rounded-3xl bg-[var(--bg-card)]/50">
                <CalendarDays className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-3" />
                <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">
                    {dict.reservations?.table?.no_reservations ||
                        "No hay reservas en esta selección"}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reservations.map((reservation) => (
                <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    location={locationMap.get(reservation.location_id)}
                    dict={dict}
                    locale={locale}
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
    canEdit: boolean;
    onEdit: (reservation: Reservation) => void;
    onCancel: (reservation: Reservation) => void;
}

function ReservationCard({
    reservation,
    location,
    dict,
    locale,
    canEdit,
    onEdit,
    onCancel,
}: ReservationCardProps) {
    const dateLocale = locale === "en" ? "en-US" : "es-ES";
    const statusClass =
        statusColors[reservation.status] || statusColors.confirmed;
    const isFinished =
        new Date(reservation.check_out_at) < new Date() ||
        reservation.cleaning_status === "completed";

    return (
        <article
            className={`surface-glass-card group relative rounded-3xl p-5 hover:border-accent/35 hover:shadow-lg hover:translate-y-[-2px] transition-all duration-300 flex flex-col justify-between ${
                reservation.status === "cancelled" ? "opacity-60" : ""
            }`}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3 mb-3 text-[10px] font-extrabold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Calendar className="w-3.5 h-3.5 text-accent" />
                        <span>
                            {new Date(
                                reservation.check_in_at
                            )
                                .toLocaleDateString(dateLocale, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "UTC",
                                })
                                .toUpperCase()}
                            {" - "}
                            {new Date(
                                reservation.check_out_at
                            )
                                .toLocaleDateString(dateLocale, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "UTC",
                                })
                                .toUpperCase()}
                        </span>
                    </div>
                    <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusClass}`}
                    >
                        {reservation.status === "confirmed"
                            ? dict.reservations?.table?.confirmed || "confirmada"
                            : reservation.status === "tentative"
                              ? dict.reservations?.table?.tentative || "tentativa"
                              : dict.reservations?.table?.cancelled || "cancelada"}
                    </span>
                </div>

                <div className="space-y-1">
                    <h3 className="text-base font-black text-[var(--text-main)] group-hover:text-accent transition-colors pt-0.5">
                        {location?.name ||
                            `Ubicación #${reservation.location_id}`}
                    </h3>
                    {location?.address && (
                        <p className="text-[10px] text-[var(--text-muted)] font-bold tracking-wide">
                            {location.address}
                        </p>
                    )}
                    <p className="text-xs text-[var(--text-main)] font-semibold mt-3">
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
                    {reservation.notes && (
                        <p className="text-2xs text-[var(--text-muted)] italic font-medium mt-1 leading-normal">
                            &ldquo;{reservation.notes}&rdquo;
                        </p>
                    )}
                </div>

                {reservation.cleaning_required && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 bg-[var(--bg-secondary)]/50 border border-[var(--border-soft)] rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-soft)] mt-4">
                            <div className="p-3">
                                <span className="block text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                                    {dict.reservations?.table?.col_provider ||
                                        "Proveedor"}
                                </span>
                                <span className="block text-[11px] font-bold text-[var(--text-main)] mt-0.5 truncate">
                                    {reservation.assigned_company_name ||
                                        dict.reservations?.filters
                                            ?.internal_management ||
                                        "Interna"}
                                </span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                                    {dict.reservations?.table
                                        ?.col_cleaning_date || "Fecha Limpieza"}
                                </span>
                                <span className="block text-[11px] font-bold text-[var(--text-main)] mt-0.5">
                                    {reservation.cleaning_scheduled_at
                                        ? `${new Date(
                                              reservation.cleaning_scheduled_at
                                          ).toLocaleDateString(dateLocale, {
                                              month: "short",
                                              day: "numeric",
                                              timeZone: "UTC",
                                          })} ${new Date(
                                              reservation.cleaning_scheduled_at
                                          ).toLocaleTimeString(dateLocale, {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              timeZone: "UTC",
                                          })}`
                                        : "—"}
                                </span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                                    {dict.reservations?.table
                                        ?.col_cleaning_status ||
                                        "Estado Limpieza"}
                                </span>
                                <span
                                    className={cn(
                                        "block text-[11px] font-black mt-0.5",
                                        reservation.cleaning_status ===
                                            "rejected"
                                            ? "text-red-500"
                                            : reservation.cleaning_status ===
                                                "requested"
                                              ? "text-orange-500"
                                              : reservation.cleaning_status ===
                                                  "completed"
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-accent"
                                    )}
                                >
                                    {reservation.cleaning_status === "rejected"
                                        ? dict.reservations?.table
                                              ?.cleaning_status_rejected ||
                                          "Rechazada"
                                        : reservation.cleaning_status ===
                                            "requested"
                                          ? dict.reservations?.table
                                                ?.cleaning_status_requested ||
                                            "Solicitada"
                                          : reservation.cleaning_status ===
                                              "completed"
                                            ? dict.reservations?.table
                                                  ?.cleaning_status_completed ||
                                              "Completada"
                                            : dict.reservations?.table
                                                  ?.cleaning_status_assigned ||
                                              "Asignada"}
                                </span>
                            </div>
                        </div>
                        {reservation.cleaning_start_locations &&
                            reservation.cleaning_start_locations.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        {dict.reservations?.table
                                            ?.work_start_locations ||
                                            "Ubicación al iniciar el fichaje"}
                                    </p>
                                    <div className="mt-2 flex flex-col gap-1.5 text-xs">
                                        {reservation.cleaning_start_locations.map(
                                            (startLocation) => (
                                                <WorkStartLocationLink
                                                    key={
                                                        startLocation.session_id
                                                    }
                                                    latitude={
                                                        startLocation.latitude
                                                    }
                                                    longitude={
                                                        startLocation.longitude
                                                    }
                                                    accuracyMeters={
                                                        startLocation.accuracy_meters
                                                    }
                                                    label={`${
                                                        startLocation.user_name
                                                    } · ${new Date(
                                                        startLocation.started_at
                                                    ).toLocaleString(
                                                        dateLocale,
                                                        { timeZone: "UTC" },
                                                    )}`}
                                                />
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                    </>
                )}
            </div>

            <div className="mt-4 pt-3.5 border-t border-[var(--border-soft)] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-accent shadow-sm shrink-0">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <div className="bg-[var(--btn-secondary-bg)] px-3 py-1.5 rounded-xl border border-[var(--border-soft)] flex items-center gap-1.5 text-[9px] font-extrabold uppercase text-[var(--btn-secondary-text)] tracking-wider">
                        <span>
                            {`${
                                dict.reservations?.table?.check_in_short ||
                                "ENTRADA"
                            } ${new Date(
                                reservation.check_in_at
                            ).toLocaleTimeString(dateLocale, {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                            })} / ${
                                dict.reservations?.table?.check_out_short ||
                                "SALIDA"
                            } ${new Date(
                                reservation.check_out_at
                            ).toLocaleTimeString(dateLocale, {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                            })}`}
                        </span>
                        <Flag className="w-3.5 h-3.5 text-[var(--btn-secondary-text)]/70 ml-0.5" />
                    </div>
                </div>

                <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                >
                    {canEdit && reservation.status !== "cancelled" && (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isFinished}
                                onClick={() => onEdit(reservation)}
                                className="bg-transparent border border-[var(--border-soft)] text-[9px] font-black uppercase hover:bg-[var(--btn-secondary-bg)] hover:text-[var(--btn-secondary-text)] px-3.5 h-8 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                <Edit3 className="w-3.5 h-3.5 text-accent" />
                                {dict.reservations?.table?.btn_edit || "Editar"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isFinished}
                                onClick={() => onCancel(reservation)}
                                className="bg-transparent border border-[var(--border-soft)] text-[9px] font-black uppercase hover:bg-[var(--btn-cancel-bg)] hover:text-[var(--btn-cancel-text)] px-3.5 h-8 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                                {dict.reservations?.table?.btn_cancel ||
                                    "Cancelar"}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}
