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
    viewMode: "map" | "photo";
    setViewMode: (mode: "map" | "photo") => void;
    onBack: () => void;
    dict: Dictionary;
    headerInfoProps: ComponentProps<typeof TechTaskHeaderInfo>;
    countersProps: ComponentProps<typeof TechTaskModalCounters>;
    reservationProps: ComponentProps<typeof TechTaskReservationContext>;
    propertyPanelsProps: ComponentProps<typeof TechTaskPropertyPanels>;
    workControlsProps: ComponentProps<typeof TechTaskWorkControls>;
    dialogsProps: ComponentProps<typeof TechTaskDialogs>;
};

export function TechTaskDetailsView({
    location,
    locationName,
    viewMode,
    setViewMode,
    onBack,
    dict,
    headerInfoProps,
    countersProps,
    reservationProps,
    propertyPanelsProps,
    workControlsProps,
    dialogsProps,
}: TechTaskDetailsViewProps) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl shadow-2xl flex flex-col max-w-2xl mx-auto animate-fade-in relative overflow-hidden">
            <TechTaskMapArea
                location={location}
                locationName={locationName}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onBack={onBack}
                dict={dict}
            />

            <div className="p-6 flex flex-col space-y-5">
                <TechTaskHeaderInfo {...headerInfoProps} />
                <TechTaskModalCounters {...countersProps} />
                <div className="space-y-4">
                    <TechTaskReservationContext {...reservationProps} />
                    <TechTaskPropertyPanels {...propertyPanelsProps} />
                </div>
                <TechTaskWorkControls {...workControlsProps} />
            </div>

            <TechTaskDialogs {...dialogsProps} />
        </div>
    );
}

// Keep TaskItem import available for consumers typing task props if needed.
export type { TaskItem };
