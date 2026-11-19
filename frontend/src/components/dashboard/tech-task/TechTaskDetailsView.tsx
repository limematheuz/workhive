"use client";

import type { ComponentProps } from "react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";
import type { TaskItem } from "@/types/user";

import {RecordHistoryPanel} from "@/components/history/RecordHistoryPanel";
import {TaskClientPublicationPanel} from "@/components/operations/TaskClientPublicationPanel";
import {TaskCloseApproval} from "@/components/operations/TaskCloseApproval";
import {SpaceWorkforceProgress} from "@/components/operations/SpaceWorkforceProgress";
import { TechTaskDialogs } from "./TechTaskDialogs";
import { TechTaskHeaderInfo } from "./TechTaskHeaderInfo";
import { TechTaskMapArea } from "./TechTaskMapArea";
import { TechTaskModalCounters } from "./TechTaskModalCounters";
import { TechTaskPropertyPanels } from "./TechTaskPropertyPanels";
import { TechTaskReservationContext } from "./TechTaskReservationContext";
import { TechTaskWorkControls } from "./TechTaskWorkControls";

type TechTaskDetailsViewProps = {
    workerMode?: boolean;
    workerEmployeeId?: number | null;
    workforceUpdated?:()=>void;
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
    workerMode = false,
    workerEmployeeId,
    workforceUpdated,
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
            <div className={`tech-task-details-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 ${scrollHide}`}>
                <TechTaskHeaderInfo {...headerInfoProps} />
                <TechTaskModalCounters {...countersProps} />
                <SpaceWorkforceProgress workerMode={workerMode} workerEmployeeId={workerEmployeeId} taskId={headerInfoProps.task.id} locationId={headerInfoProps.task.location_id} canManage={!workerMode && Boolean(location?.can_manage_tasks)} active={headerInfoProps.isCurrentTaskSessionActive} updated={workforceUpdated??(()=>{})}/>
                {!workerMode && location?.can_manage_tasks&&<TaskClientPublicationPanel taskId={headerInfoProps.task.id} updated={workforceUpdated}/>}
                {!workerMode && location?.can_manage_tasks&&<TaskCloseApproval taskId={headerInfoProps.task.id} updated={workforceUpdated??(()=>{})}/>}
                <div className="space-y-4">
                    <TechTaskReservationContext {...reservationProps} />
                    <TechTaskPropertyPanels {...propertyPanelsProps} />
                </div>
                <details className="rounded-xl border border-[var(--border-soft)]"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">Ver ubicación en el mapa</summary><TechTaskMapArea location={location} locationName={locationName} dict={dict} /></details>
                {!workerMode && location?.can_manage_tasks && <details className="rounded-xl border border-[var(--border-soft)]"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">Historial del trabajo</summary><RecordHistoryPanel entityType="task_item" entityId={headerInfoProps.task.id}/></details>}
            </div>

            <div className="tech-task-details-footer shrink-0 border-t border-[var(--border-soft)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                <TechTaskWorkControls {...workControlsProps} />
            </div>

            <TechTaskDialogs {...dialogsProps} />
        </div>
    );
}

export type { TaskItem };
