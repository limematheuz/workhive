export type TaskStatus =
    | "requested"
    | "pending"
    | "accepted"
    | "rejected"
    | "progress"
    | "review"
    | "completed";

export type TaskStatusValue =
    | TaskStatus
    | "in_progress"
    | "in_review"
    | "cancelled";
export type KanbanStatus = "pending" | "progress" | "completed";

export type TaskPriority = "low" | "medium" | "high";
