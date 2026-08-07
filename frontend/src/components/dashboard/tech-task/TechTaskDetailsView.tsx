"use client";

import type { ComponentProps } from "react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";
import type { TaskItem } from "@/types/user";

import { TechTaskDialogs } from "./TechTaskDialogs";
import { TechTaskHeaderInfo } from "./TechTaskHeaderInfo";
import { TechTaskMapArea } from "./TechTaskMapArea";
import { TechTaskModalCounters } from "./TechTaskModalCounters";
import { TechTaskPropertyPanels } from "./TechTaskPropertyPanels";
import { TechTaskReservationContext } from "./TechTaskReservationContext";
import { TechTaskWorkControls } from "./TechTaskWorkControls";

type TechTaskDetailsViewProps = {
    location: Location | null;
    locationName: string;
    dict: Dictionary;
    headerInfoProps: ComponentProps<typeof TechTaskHeaderInfo>;
    countersProps: ComponentProps<typeof TechTaskModalCounters>;
    reservationProps: ComponentProps<typeof TechTaskReservationContext>;
    propertyPanelsProps: ComponentProps<typeof TechTaskPropertyPanels>;
    workControlsProps: ComponentProps<typeof TechTaskWorkControls>;
    dialogsProps: ComponentProps<typeof TechTaskDialogs>;
};

const scrollHide =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export function TechTaskDetailsView({
    location,
    locationName,
    dict,
    headerInfoProps,
    countersProps,
    reservationProps,
    propertyPanelsProps,
    workControlsProps,
    dialogsProps,
}: TechTaskDetailsViewProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            <TechTaskMapArea
                location={location}
                locationName={locationName}
                dict={dict}
            />

            <div className={`tech-task-details-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 ${scrollHide}`}>
                <TechTaskHeaderInfo {...headerInfoProps} />
                <TechTaskModalCounters {...countersProps} />
                <div className="space-y-4">
                    <TechTaskReservationContext {...reservationProps} />
                    <TechTaskPropertyPanels {...propertyPanelsProps} />
                </div>
            </div>

            <div className="tech-task-details-footer shrink-0 border-t border-[var(--border-soft)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                <TechTaskWorkControls {...workControlsProps} />
            </div>

            <TechTaskDialogs {...dialogsProps} />
        </div>
    );
}

export type { TaskItem };
