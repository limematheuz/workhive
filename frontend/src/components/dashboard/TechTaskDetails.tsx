"use client";

import type { Location } from "@/types/location";
import type { TaskItem, User } from "@/types/user";

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

    return <TechTaskDetailsView {...viewProps} />;
}
