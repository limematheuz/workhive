import { canManageCompanyTasks } from "../access/roles.ts";
import type { TaskItem, User } from "../../types/user.ts";

export function canMoveTaskOnKanban(
    user: User | null | undefined,
    task: Pick<TaskItem, "is_invoiced"> | null | undefined,
): boolean {
    return canManageCompanyTasks(user) && Boolean(task) && !task?.is_invoiced;
}
