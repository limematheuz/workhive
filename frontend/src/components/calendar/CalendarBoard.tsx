"use client";

import { RefObject } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { EventResizeDoneArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
    DatesSetArg,
    EventClickArg,
    EventDropArg,
    EventInput,
} from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";

import {
    CalendarEventContent,
} from "./CalendarEventContent";

type CalendarBoardProps = {
    calendarRef: RefObject<FullCalendar | null>;
    calendarView: string;
    locale: string;
    canEdit: boolean;
    events: EventInput[];
    onDatesSet: (arg: DatesSetArg) => void;
    onEventClick: (eventInfo: EventClickArg) => void;
    onEventDrop: (arg: EventDropArg) => void;
    onEventResize: (arg: EventResizeDoneArg) => void;
};

export function CalendarBoard({
    calendarRef,
    calendarView,
    locale,
    canEdit,
    events,
    onDatesSet,
    onEventClick,
    onEventDrop,
    onEventResize,
}: CalendarBoardProps) {
    return (
        <div className="workhive-fullcalendar">
            <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView={calendarView}
                locale={locale === "es" ? esLocale : "en"}
                firstDay={1}
                headerToolbar={false}
                allDaySlot={false}
                nowIndicator
                editable={canEdit}
                eventStartEditable={canEdit}
                eventDurationEditable={canEdit}
                eventResizableFromStart={canEdit}
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                slotDuration="00:30:00"
                slotLabelInterval="01:00"
                scrollTime="08:00:00"
                height="auto"
                expandRows
                dayMaxEvents={false}
                eventMaxStack={50}
                slotEventOverlap={false}
                events={events}
                datesSet={onDatesSet}
                eventContent={(eventInfo) => <CalendarEventContent eventInfo={eventInfo} />}
                eventClick={onEventClick}
                eventDrop={onEventDrop}
                eventResize={onEventResize}
            />
        </div>
    );
}
