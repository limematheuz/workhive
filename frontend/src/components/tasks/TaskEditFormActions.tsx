"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import { canDuplicateTask } from "@/domain/tasks/task-permissions";
import type { User } from "@/types/user";
import {
    taskDialogDangerBtnClass,
    taskDialogFooterClass,
    taskDialogPrimaryBtnClass,
    taskDialogSecondaryBtnClass,
} from "./taskDialogChrome";

type TaskEditFormActionsProps = {
    dict: Dictionary;
    currentUser: User | null;
    selectedTask: TaskItem;
    immutable: boolean;
    managerEditable: boolean;
    adminOrManager: boolean;
    receiverCompany: boolean;
    deletingTask: boolean;
    saving: boolean;
    handleDeleteTask: (task: TaskItem) => void;
    handleDuplicateTask: (task: TaskItem) => Promise<void>;
};

export function TaskEditFormActions({
    dict,
    currentUser,
    selectedTask,
    immutable,
    managerEditable,
    adminOrManager,
    receiverCompany,
    deletingTask,
    saving,
    handleDeleteTask,
    handleDuplicateTask,
}: TaskEditFormActionsProps) {
    const allowDuplicate = canDuplicateTask(currentUser, selectedTask) && adminOrManager && !receiverCompany;

    return (
        <div className={taskDialogFooterClass}>
            <div className="flex flex-wrap gap-2">
                {!immutable && adminOrManager && !receiverCompany && (
                    <button
                        type="button"
                        onClick={() => handleDeleteTask(selectedTask)}
                        disabled={deletingTask}
                        className={taskDialogDangerBtnClass}
                    >
                        {deletingTask ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {deletingTask ? dict.tasks.deleting : dict.tasks.dialog.btn_delete}
                    </button>
                )}
                {allowDuplicate && (
                    <button
                        type="button"
                        onClick={() => { void handleDuplicateTask(selectedTask); }}
                        disabled={saving}
                        className={taskDialogSecondaryBtnClass}
                    >
                        <Copy className="h-3.5 w-3.5" />
                        {dict.tasks.duplicate || "Duplicar"}
                    </button>
                )}
            </div>

            {managerEditable && (
                <button
                    type="submit"
                    disabled={saving}
                    className={`${taskDialogPrimaryBtnClass} ml-auto min-w-[9.5rem]`}
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? dict.tasks.dialog.saving_btn : (dict.tasks?.dialog?.save_btn || "Save Changes")}
                </button>
            )}
        </div>
    );
}
