import type { EventContentArg } from "@fullcalendar/core";
import { CheckCircle2, Hammer, TriangleAlert } from "lucide-react";
import type { TaskStatus } from "@/types/task";

export interface CalendarEventProps {
    locationName: string;
    userName: string;
    status: TaskStatus;
    isExternal: boolean;
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
        <div className={`min-w-0 space-y-0.5 px-2.5 py-2 text-[10px] leading-tight sm:px-3 sm:text-[11px] ${props.isExternal ? "border-l-2 border-white/80 pl-1.5" : ""}`}>
            <div className="flex min-w-0 items-center gap-1 truncate font-black">
                <StatusIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{eventInfo.event.title}</span>
            </div>
            <div className="truncate font-semibold opacity-90">
                {eventInfo.timeText}
            </div>
            <div className="hidden truncate opacity-80 sm:block">
                {props.locationName}
            </div>
            <div className="hidden truncate opacity-80 md:block">
                {props.userName}
            </div>
        </div>
    );
}
