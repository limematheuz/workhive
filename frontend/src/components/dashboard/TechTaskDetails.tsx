"use client";

import type { Location } from "@/types/location";
import type { TaskItem, User } from "@/types/user";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

import { TechTaskDetailsView } from "./tech-task/TechTaskDetailsView";
import { useTechTaskDetailsController } from "./tech-task/hooks/useTechTaskDetailsController";

interface TechTaskDetailsProps {
    task: TaskItem;
    location: Location | null;
    locationName: string;
    currentUser: User;
    onBack: () => void;
    onStatusUpdate: () => void;
}

export function TechTaskDetails({
    task,
    location,
    locationName,
    currentUser,
    onBack,
    onStatusUpdate,
}: TechTaskDetailsProps) {
    const viewProps = useTechTaskDetailsController({
        task,
        location,
        locationName,
        currentUser,
        onBack,
        onStatusUpdate,
    });

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onBack();
            }}
        >
            <DialogContent
                overlayClassName="tech-task-details-overlay"
                className="tech-task-details-dialog flex max-h-[min(92vh,880px)] w-[min(100%-1.25rem,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
            >
                <DialogTitle className="sr-only">{task.title}</DialogTitle>
                <DialogDescription className="sr-only">
                    {locationName}
                </DialogDescription>
                <TechTaskDetailsView {...viewProps} />
            </DialogContent>
        </Dialog>
    );
}
