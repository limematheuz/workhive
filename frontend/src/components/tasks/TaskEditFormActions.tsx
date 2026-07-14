"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";
import { canDuplicateTask } from "@/domain/tasks/task-permissions";
import type { User } from "@/types/user";

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

const chip =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-none disabled:cursor-not-allowed disabled:opacity-40";

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
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-4">
            <div className="flex flex-wrap gap-2">
                {!immutable && adminOrManager && !receiverCompany && (
                    <button
                        type="button"
                        onClick={() => handleDeleteTask(selectedTask)}
                        disabled={deletingTask}
                        className={`${chip} bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)]`}
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
                        className={`${chip} bg-accent text-white shadow-sm hover:bg-accent-light`}
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
                    className={`${chip} ml-auto border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm hover:bg-[var(--btn-primary-hover-bg)]`}
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {saving ? dict.tasks.dialog.saving_btn : (dict.tasks?.dialog?.save_btn || "Save Changes")}
                </button>
            )}
        </div>
    );
}
