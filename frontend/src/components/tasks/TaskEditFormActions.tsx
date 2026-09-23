"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import { canDuplicateTask } from "@/domain/tasks/task-permissions";
import type { User } from "@/types/user";
import {
    taskDialogFooterClass,
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
                    <Button
                        type="button"
                        variant="dangerSoft"
                        size="sm"
                        onClick={() => handleDeleteTask(selectedTask)}
                        disabled={deletingTask}
                    >
                        {deletingTask ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {deletingTask ? dict.tasks.deleting : dict.tasks.dialog.btn_delete}
                    </Button>
                )}
                {allowDuplicate && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => { void handleDuplicateTask(selectedTask); }}
                        disabled={saving}
                    >
                        <Copy className="h-3.5 w-3.5" />
                        {dict.tasks.duplicate || "Duplicar"}
                    </Button>
                )}
            </div>

            {managerEditable && (
                <Button
                    type="submit"
                    size="sm"
                    disabled={saving}
                    className="ml-auto min-w-[9.5rem]"
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? dict.tasks.dialog.saving_btn : (dict.tasks?.dialog?.save_btn || "Save Changes")}
                </Button>
            )}
        </div>
    );
}
