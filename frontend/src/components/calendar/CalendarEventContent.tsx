import type { EventContentArg } from "@fullcalendar/core";
import { CheckCircle2, Hammer, TriangleAlert } from "lucide-react";
import type { TaskStatus } from "@/types/task";

export interface CalendarEventProps {
    locationName: string;
    userName: string;
    status: TaskStatus;
    isExternal: boolean;
    isPast?: boolean;
}

export function CalendarEventContent({
    eventInfo,
}: {
    eventInfo: EventContentArg;
}) {
    const props = eventInfo.event.extendedProps as CalendarEventProps;
    const StatusIcon = props.status === "completed"
        ? CheckCircle2
        : props.status === "progress" || props.status === "accepted"
            ? Hammer
            : TriangleAlert;

    return (
        <div className="workhive-calendar-event-body min-w-0 space-y-0.5 px-2.5 py-2 text-[10px] leading-tight sm:px-3 sm:text-[11px]">
            <div className="flex min-w-0 items-center gap-1 truncate font-black">
                <StatusIcon className="h-3 w-3 shrink-0 opacity-90" />
                <span className="truncate">{eventInfo.event.title}</span>
            </div>
            {eventInfo.timeText && (
                <div className="truncate font-semibold opacity-80">
                    {eventInfo.timeText}
                </div>
            )}
            <div className="hidden truncate opacity-75 sm:block">
                {props.locationName}
            </div>
            <div className="hidden truncate opacity-70 md:block">
                {props.userName}
            </div>
        </div>
    );
}
