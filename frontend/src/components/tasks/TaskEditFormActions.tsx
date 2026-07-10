"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";
import type { TaskItem } from "@/services/task.service";

type TaskEditFormActionsProps = {
    dict: Dictionary;
    selectedTask: TaskItem;
    immutable: boolean;
    managerEditable: boolean;
    adminOrManager: boolean;
    receiverCompany: boolean;
    deletingTask: boolean;
    saving: boolean;
    onClose: () => void;
    handleDeleteTask: (task: TaskItem) => void;
    handleDuplicateTask: (task: TaskItem) => Promise<void>;
};

export function TaskEditFormActions({
    dict,
    selectedTask,
    immutable,
    managerEditable,
    adminOrManager,
    receiverCompany,
    deletingTask,
    saving,
    onClose,
    handleDeleteTask,
    handleDuplicateTask,
}: TaskEditFormActionsProps) {
    return (
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-soft)] pt-6 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
                {!immutable && adminOrManager && !receiverCompany && (
                    <Button
                        type="button"
                        onClick={() => handleDeleteTask(selectedTask)}
                        disabled={deletingTask}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98]"
                    >
                        {deletingTask ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {dict.tasks.deleting}
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-3.5 w-3.5" />
                                {dict.tasks.dialog.btn_delete}
                            </>
                        )}
                    </Button>
                )}
                {adminOrManager && !receiverCompany && (
                    <Button
                        type="button"
                        onClick={() => handleDuplicateTask(selectedTask)}
                        disabled={saving}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none bg-accent px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-accent-light active:scale-[0.98]"
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                            />
                        </svg>
                        Duplicate
                    </Button>
                )}
            </div>

            <div className="ml-auto flex w-full gap-2 sm:w-auto">
                <Button
                    type="button"
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 cursor-pointer rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--btn-cancel-text)] transition-all hover:border-transparent hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] sm:flex-initial"
                >
                    {dict.tasks.dialog.close_btn}
                </Button>

                {managerEditable && (
                    <Button
                        type="submit"
                        disabled={saving}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-5 py-2.5 text-xs font-semibold text-[var(--btn-primary-text)] transition-all hover:bg-[var(--btn-primary-hover-bg)] sm:flex-initial"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {dict.tasks.dialog.saving_btn}
                            </>
                        ) : (
                            dict.tasks?.dialog?.save_btn || "Save Changes"
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
