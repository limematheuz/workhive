import type { Dictionary } from "@/lib/dictionary-context";
import type { WorkSession } from "@/services/work-session.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/types/user";

export interface WorkSessionPanelProps {
    dict: Pick<Dictionary, "work_sessions" | "profile">;
    activeSession: WorkSession | null;
    activeLocationName: string;
    activeTaskTitle?: string;
    elapsedTime: string;
    availableTasks: TaskItem[];
    locations: Location[];
    actionLoading: boolean;
    sessionFailed: boolean;
    onOpenTask: (task: TaskItem) => void;
    onRetry: () => void;
    onPreStopShift: () => void;
    onTogglePause: () => void;
}
