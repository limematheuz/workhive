import { cn } from "@/lib/utils";
import type { TaskChecklistItem } from "@/lib/task-checklist";
import type { User } from "@/types/user";

interface TaskChecklistEditorProps {
    items: TaskChecklistItem[];
    users: User[];
    canEdit: boolean;
    onToggle: (itemIndex: number) => void;
    onAssign: (itemIndex: number, userId: string) => void;
}

export function TaskChecklistEditor({
    items,
    users,
    canEdit,
    onToggle,
    onAssign,
}: TaskChecklistEditorProps) {
    return (
        <div className="space-y-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/10 p-4 font-sans">
            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={item.index}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onToggle(item.index)}
                                className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                                    item.checked
                                        ? "border-accent bg-accent text-white"
                                        : "border-[var(--border-color)] bg-[var(--dialog-control-bg)] text-transparent",
                                    canEdit ? "cursor-pointer hover:border-accent" : "cursor-default"
                                )}
                            >
                                <span className="text-[11px] font-black leading-none">✓</span>
                            </button>
                            <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onToggle(item.index)}
                                className={cn(
                                    "flex-1 select-none truncate-normal break-words pr-2 text-left font-semibold leading-tight transition-colors duration-200 bg-transparent border-none p-0",
                                    item.checked
                                        ? "text-[var(--text-muted)] line-through"
                                        : "text-[var(--text-main)]",
                                    canEdit ? "cursor-pointer hover:text-accent" : "cursor-default"
                                )}
                            >
                                {item.text}
                            </button>
                        </div>

                        {canEdit ? (
                            <div
                                className="relative shrink-0"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <select
                                    value={
                                        item.assignedUserId?.toString() || "unassigned"
                                    }
                                    onChange={(event) =>
                                        onAssign(item.index, event.target.value)
                                    }
                                    aria-label={`Asignar trabajador: ${item.text}`}
                                    className="dialog-compact-control max-w-[140px] cursor-pointer appearance-none truncate rounded-full border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-1 text-center text-[10px] font-bold text-[var(--text-main)] outline-none transition-all hover:bg-[var(--bg-secondary)]"
                                >
                                    <option value="unassigned">-- Unassigned --</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id.toString()}>
                                            {user.full_name || user.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            item.assignedUserId && (
                                <span
                                    className="shrink-0 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent dark:text-accent"
                                    title={item.assignedUserName}
                                >
                                    {item.assignedUserName
                                        ? item.assignedUserName
                                              .split(" ")
                                              .map((name) => name[0])
                                              .join("")
                                              .toUpperCase()
                                              .slice(0, 2)
                                        : `ID: ${item.assignedUserId}`}
                                </span>
                            )
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
