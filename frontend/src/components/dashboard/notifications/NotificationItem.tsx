"use client";

import { BellRing, MapPin, ShieldAlert } from "lucide-react";

import type { CompanyCollaboration } from "@/types/collaboration";
import type { Reservation } from "@/types/reservation";
import type { TaskItem } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import type { PrivacyRequest } from "@/services/privacy.service";
import type { PersistentNotification } from "@/services/notification.service";

type NotificationType =
    | "persistent"
    | "persistent-alert"
    | "collaboration"
    | "arrival"
    | "task"
    | "task-rejected"
    | "task-overdue"
    | "reservation-cancelled"
    | "privacy-request";

interface NotificationItemProps {
    type: NotificationType;
    data: PersistentNotification | TaskItem | CompanyCollaboration | Reservation | PrivacyRequest;
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

interface NotificationContentProps {
    disabled: boolean;
    onClick: () => void;
    dict: Dictionary;
    locale: string;
    locationName?: string;
    previewText?: string;
    linkedArrivalDate?: string | null;
    linkedArrivalGuests?: number;
    timeLabel?: string;
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
    const sharedProps: NotificationContentProps = {
        disabled: openingNotificationKey === notificationKey,
        onClick,
        dict,
        locale,
        locationName,
        previewText,
        linkedArrivalDate,
        linkedArrivalGuests,
        timeLabel,
    };

    switch (type) {
        case "persistent":
            return <PersistentNotificationItem notification={data as PersistentNotification} {...sharedProps} />;
        case "persistent-alert":
            return <PersistentNotificationItem notification={data as PersistentNotification} danger {...sharedProps} />;
        case "collaboration":
            return <CollaborationNotificationItem collaboration={data as CompanyCollaboration} {...sharedProps} />;
        case "arrival":
            return <ArrivalNotificationItem reservation={data as Reservation} {...sharedProps} />;
        case "task":
            return <TaskNotificationItem task={data as TaskItem} {...sharedProps} />;
        case "task-rejected":
            return <RejectedTaskNotificationItem task={data as TaskItem} {...sharedProps} />;
        case "task-overdue":
            return <OverdueTaskNotificationItem task={data as TaskItem} {...sharedProps} />;
        case "reservation-cancelled":
            return <CancelledReservationNotificationItem reservation={data as Reservation} {...sharedProps} />;
        case "privacy-request":
            return <PrivacyRequestNotificationItem request={data as PrivacyRequest} {...sharedProps} />;
    }
}

function NotificationButton({
    children,
    className,
    disabled,
    onClick,
}: Pick<NotificationContentProps, "disabled" | "onClick"> & {
    children: React.ReactNode;
    className: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`block w-full rounded-2xl p-3 text-left transition-colors disabled:opacity-60 ${className}`}
        >
            {children}
        </button>
    );
}

function NotificationLocation({ locationName }: Pick<NotificationContentProps, "locationName">) {
    return (
        <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{locationName}</span>
        </p>
    );
}

function NotificationBadge({
    children,
    danger = false,
}: {
    children: React.ReactNode;
    danger?: boolean;
}) {
    return (
        <span
            className={danger
                ? "shrink-0 rounded-lg border border-[var(--btn-cancel-border)] px-2 py-1 text-[10px] font-black uppercase text-[var(--btn-cancel-text)]"
                : "shrink-0 rounded-lg border border-accent/30 bg-accent px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm shadow-accent/30"}
        >
            {children}
        </span>
    );
}

function PersistentNotificationItem({
    notification,
    danger = false,
    ...props
}: NotificationContentProps & { notification: PersistentNotification; danger?: boolean }) {
    return (
        <NotificationButton {...props} className={danger
            ? "border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] hover:bg-[var(--bg-tertiary)]"
            : "border border-accent/20 bg-accent/[0.06] hover:bg-accent/10"}>
            <p className="text-sm font-black text-[var(--text-main)]">{notification.title}</p>
            <p className="mt-1.5 text-xs font-semibold text-[var(--text-muted)]">{notification.message}</p>
            <p className={`mt-2 text-[10px] font-bold uppercase ${danger ? "text-[var(--btn-cancel-text)]" : "text-accent"}`}>
                {danger
                    ? (props.dict.notifications?.types?.overdue || "Con retraso")
                    : notification.event_type === "task.reported" ? "Reporte de tarea" : "Tarea"}
            </p>
        </NotificationButton>
    );
}

function CollaborationNotificationItem({
    collaboration,
    dict,
    locale,
    ...props
}: NotificationContentProps & { collaboration: CompanyCollaboration }) {
    const message = dict.notifications?.messages?.collab_request;
    const collaboratorName = collaboration.initiator?.name || (locale === "en" ? "Unknown" : "Desconocida");

    return (
        <NotificationButton {...props} className="border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-tertiary)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--text-main)]">
                        {dict.notifications?.types?.link_request || "Solicitud de vinculación"}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {dict.notifications?.types?.collaboration || "Colaboración"}
                    </p>
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                        {message ? (
                            <CollaborationMessage template={message} collaboratorName={collaboratorName} />
                        ) : locale === "en" ? (
                            <>Company <span className="font-bold text-[var(--text-main)]">{collaboratorName}</span> wants to collaborate with you.</>
                        ) : (
                            <>La empresa <span className="font-bold text-[var(--text-main)]">{collaboratorName}</span> quiere colaborar contigo.</>
                        )}
                    </p>
                </div>
                <NotificationBadge>{dict.notifications?.messages?.collab_pending || "Pendiente"}</NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function CollaborationMessage({
    template,
    collaboratorName,
}: {
    template: string;
    collaboratorName: string;
}) {
    const [beforeName = "", ...afterNameParts] = template.split("{name}");
    return (
        <>
            {beforeName}
            <span className="font-bold text-[var(--text-main)]">{collaboratorName}</span>
            {afterNameParts.join(collaboratorName)}
        </>
    );
}

function ArrivalNotificationItem({
    reservation,
    dict,
    locale,
    locationName,
    timeLabel,
    ...props
}: NotificationContentProps & { reservation: Reservation }) {
    const arrivalAt = new Date(reservation.check_in_at);
    const dateLocale = locale === "en" ? "en-US" : "es-ES";
    const arrivalDate = arrivalAt.toLocaleString(dateLocale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <NotificationButton {...props} className="border border-accent/20 bg-accent/[0.06] hover:bg-accent/10">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-black text-[var(--text-main)]">
                        <BellRing className="h-4 w-4 text-accent" />
                        {dict.notifications?.types?.arrival_reminder || "Recordatorio de llegada"}
                    </p>
                    <NotificationLocation locationName={locationName} />
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                        {dict.notifications?.messages?.arrival_reminder_desc
                            ? dict.notifications.messages.arrival_reminder_desc
                                .replace("{count}", reservation.guest_count.toString())
                                .replace("{timeLabel}", timeLabel || "")
                                .replace("{dateStr}", arrivalDate)
                            : locale === "en"
                                ? <>Arrival of {reservation.guest_count} guests {timeLabel || ""}, on {arrivalDate}.</>
                                : <>Llegan {reservation.guest_count} huéspedes {timeLabel || ""}, el {arrivalDate}.</>}
                    </p>
                </div>
                <NotificationBadge>{dict.notifications?.types?.incoming || "Próxima"}</NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function TaskNotificationItem({
    task,
    dict,
    locationName,
    previewText,
    linkedArrivalDate,
    linkedArrivalGuests,
    ...props
}: NotificationContentProps & { task: TaskItem }) {
    return (
        <NotificationButton {...props} className="border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-tertiary)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                    <NotificationLocation locationName={locationName} />
                    <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">{previewText}</p>
                    {task.status === "requested" && linkedArrivalDate && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-accent">
                            <BellRing className="h-3.5 w-3.5" />
                            {(dict.reservations?.table?.check_in || "Entrada")} el {linkedArrivalDate} · {linkedArrivalGuests} {(dict.reservations?.table?.guests || "huéspedes")}
                        </p>
                    )}
                </div>
                <NotificationBadge>
                    {task.status === "requested" ? (dict.notifications?.types?.request || "Solicitud") : (dict.tech?.status_new || "Nueva")}
                </NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function RejectedTaskNotificationItem({
    task,
    locationName,
    previewText,
    dict,
    ...props
}: NotificationContentProps & { task: TaskItem }) {
    return (
        <NotificationButton {...props} className="border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] hover:bg-[var(--bg-tertiary)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                    <NotificationLocation locationName={locationName} />
                    <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">{previewText}</p>
                </div>
                <NotificationBadge danger>{dict.notifications?.types?.rejected || "Rechazada"}</NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function OverdueTaskNotificationItem({
    task,
    locationName,
    previewText,
    dict,
    ...props
}: NotificationContentProps & { task: TaskItem }) {
    return (
        <NotificationButton {...props} className="border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] hover:bg-[var(--bg-tertiary)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-main)]">{task.title}</p>
                    <NotificationLocation locationName={locationName} />
                    <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">{previewText}</p>
                </div>
                <NotificationBadge danger>{dict.notifications?.types?.overdue || "Con retraso"}</NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function CancelledReservationNotificationItem({
    reservation,
    dict,
    locale,
    locationName,
    ...props
}: NotificationContentProps & { reservation: Reservation }) {
    const checkInDate = new Date(reservation.check_in_at).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
        timeZone: "UTC",
    });
    const message = dict.notifications?.messages?.reservation_cancelled_desc;

    return (
        <NotificationButton {...props} className="border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] hover:bg-[var(--bg-tertiary)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--text-main)]">
                        {dict.notifications?.types?.reservation_cancelled || "Reserva cancelada"}
                    </p>
                    <NotificationLocation locationName={locationName} />
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
                        {message ? message.replace("{dateStr}", checkInDate) : locale === "en"
                            ? <>The reservation checking in on {checkInDate} has been cancelled.</>
                            : <>La reserva con entrada el {checkInDate} ha sido cancelada.</>}
                    </p>
                </div>
                <NotificationBadge danger>{dict.notifications?.types?.cancelled || "Cancelada"}</NotificationBadge>
            </div>
        </NotificationButton>
    );
}

function PrivacyRequestNotificationItem({
    request,
    locale,
    ...props
}: NotificationContentProps & { request: PrivacyRequest }) {
    return (
        <NotificationButton {...props} className="border border-red-500/30 bg-red-500/10 hover:bg-red-500/15">
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
        </NotificationButton>
    );
}
