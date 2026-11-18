"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react";
import { TaskItem, User } from "@/types/user";
import { TaskService } from "@/services/task.service";
import { TaskReportService } from "@/services/task-report.service";
import { UploadService } from "@/services/upload.service";
import { UserService } from "@/services/user.service";
import { canManageCompanyTasks } from "@/domain/access/roles";
import { parseTaskChecklistItems } from "@/lib/format";
import { filterVisibleChecklistItems } from "@/lib/task-checklist-view";
import { toast } from "@/lib/toast";
import type { Dictionary } from "@/lib/dictionary-context";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {spaceWorkforce,type SpaceWorker} from "@/services/workforce-execution.service";

export interface ChecklistItem {
    id: string;
    category: "General";
    question: string;
    answer: "yes" | "no" | null;
    note: string;
    photoAttached: boolean;
    assignedUserId?: number;
    assignedUserName?: string;
}

interface UseTechTaskChecklistParams {
    workerMode?: boolean;
    workerEmployeeId?: number | null;
    task: TaskItem;
    currentUser: User;
    isCurrentTaskSessionActive: boolean;
    onStatusUpdate: () => void;
    dict: Dictionary;
}

interface UseTechTaskChecklistReturn {
    checklist: ChecklistItem[];
    isParsedChecklist: boolean;
    completedCount: number;
    totalCount: number;
    ownChecklistItems: ChecklistItem[];
    ownCompletedCount: number;
    ownTotalCount: number;
    visibleCompletedCount: number;
    visibleTotalCount: number;
    filteredItems: ChecklistItem[];
    categoryItems: ChecklistItem[];
    hideCompleted: boolean;
    setHideCompleted: React.Dispatch<React.SetStateAction<boolean>>;
    expandedItem: string | null;
    setExpandedItem: React.Dispatch<React.SetStateAction<string | null>>;
    activeCategory: "General" | "Baño" | "Cocina";
    setActiveCategory: React.Dispatch<React.SetStateAction<"General" | "Baño" | "Cocina">>;
    uploadingChecklistItem: string | null;
    availableAssignees: User[];
    handleAnswer: (itemId: string, answer: "yes" | "no") => Promise<void>;
    handleNoteChange: (itemId: string, note: string) => void;
    persistChecklistNote: (itemId: string, note: string) => Promise<boolean>;
    handleChecklistPhoto: (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleResetChecklist: () => Promise<void>;
    handleAddChecklistItem: (question: string, assigneeId: number) => Promise<boolean>;
    getCategoryForItem: (question: string) => "General" | "Baño" | "Cocina";
}

interface ChecklistStore {
    sourceKey: string;
    items: ChecklistItem[];
}

function getCategoryForItem(question: string): "General" | "Baño" | "Cocina" {
    const q = question.toLowerCase();
    if (q.includes("baño") || q.includes("lavabo") || q.includes("toalla") || q.includes("amenities") || q.includes("ducha") || q.includes("termo") || q.includes("agua caliente")) {
        return "Baño";
    }
    if (q.includes("cocina") || q.includes("café") || q.includes("té") || q.includes("nevera") || q.includes("microondas") || q.includes("lavavajillas") || q.includes("horno") || q.includes("platos")) {
        return "Cocina";
    }
    return "General";
}

function getChecklistStorageKey(taskId: number) {
    return `workhive_checklist_task_${taskId}`;
}

function readStoredChecklist(taskId: number): ChecklistItem[] {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem(getChecklistStorageKey(taskId));
    if (!saved) return [];

    try {
        return JSON.parse(saved) as ChecklistItem[];
    } catch {
        return [];
    }
}

function getChecklistSourceKey(task: TaskItem) {
    return JSON.stringify({
        id: task.id,
        description: task.description ?? "",
        evidence: task.checklist_evidence ?? {},
        checklist: task.checklist_items ?? null,
    });
}

function mergeParsedChecklist(parsed: ChecklistItem[], previous: ChecklistItem[]) {
    return parsed.map(parsedItem => {
        const existing = previous.find(prevItem => prevItem.id === parsedItem.id)
            || previous.find(prevItem => prevItem.question === parsedItem.question);
        if (!existing) return parsedItem;

        return {
            ...parsedItem,
            note: existing.note,
            photoAttached: existing.photoAttached,
        };
    });
}

export function useTechTaskChecklist({
    workerMode = false,
    workerEmployeeId,
    task,
    currentUser,
    isCurrentTaskSessionActive,
    onStatusUpdate,
    dict,
}: UseTechTaskChecklistParams): UseTechTaskChecklistReturn {
    const [hideCompleted, setHideCompleted] = useState(false);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<"General" | "Baño" | "Cocina">("General");
    const [uploadingChecklistItem, setUploadingChecklistItem] = useState<string | null>(null);
    const [teamAssignees, setTeamAssignees] = useState<User[]>([]);
    const canAssignTeam = !workerMode && currentUser?.id ? canManageCompanyTasks(currentUser) : false;
    const availableAssignees = canAssignTeam
        ? teamAssignees
        : currentUser?.id
            ? [currentUser]
            : [];
    const allocationKey=task.id+":"+(workerEmployeeId??"unlinked");
    const [workforce,setWorkforce]=useState<{key:string;rows:SpaceWorker[];failed:boolean}|null>(null);
    const requestWorkforce=useCallback(()=>spaceWorkforce(task.id),[task.id]);
    useResourceEffect(workerMode,allocationKey+":"+isCurrentTaskSessionActive,requestWorkforce,
        rows=>setWorkforce({key:allocationKey,rows,failed:false}),()=>setWorkforce({key:allocationKey,rows:[],failed:true}));
    const ownAllocationRows=useMemo(()=>workforce?.key===allocationKey?workforce.rows.filter(row=>row.employee_id===workerEmployeeId):[],[workforce,allocationKey,workerEmployeeId]);
    const ownAnswers=useMemo(()=>{const answers=new Map<number,"yes"|"no"|null>();for(const row of ownAllocationRows)for(const step of row.tasks)answers.set(step.id,step.completed?(step.answer==="no"?"no":"yes"):null);return answers;},[ownAllocationRows]);
    const structuredById=useMemo(()=>new Map((task.checklist_items??[]).map(item=>[item.id,item])),[task.checklist_items]);

    useEffect(() => {
        if (!currentUser?.id || !canAssignTeam) return;
        void UserService.getUsers()
            .then(users => setTeamAssignees(
                users.filter(user => user.is_active !== false)
            ))
            .catch(() => setTeamAssignees([currentUser]));
    }, [canAssignTeam, currentUser]);

    const parseDescriptionChecklist = useCallback((): ChecklistItem[] | null => {
        const usesStructuredChecklist = Boolean(task.checklist_items?.length);
        const visible=parseTaskChecklistItems(task).filter(item=>{
            if(!workerMode)return true;
            const structured=item.structuredId?structuredById.get(item.structuredId):undefined;
            return structured?!structured.assignments.length||structured.assignments.some(row=>row.user_id===currentUser.id):!item.assignedUserId||item.assignedUserId===currentUser.id;
        });
        const items = visible.map((item, index) => {
            const itemId = item.structuredId ? `item_${item.structuredId}` : `parsed_${index + 1}`;
            const recordedAnswer = task.checklist_evidence?.[itemId]?.answer ?? null;
            const personal=workerMode&&item.structuredId?structuredById.get(item.structuredId)?.assignments.find(row=>row.user_id===currentUser.id):undefined;
            return {
                id: itemId,
                category: "General" as const,
                question: item.text,
                // Structured rows and their evidence are both persisted task
                // state. A legacy answer is still a valid completed step until
                // the database migration materialises it in `completed`.
                answer: workerMode&&item.structuredId&&ownAnswers.has(item.structuredId)?ownAnswers.get(item.structuredId)??null:personal?.status==="completed"?"yes" as const:item.checked
                    ? "yes" as const
                    : usesStructuredChecklist
                        ? (recordedAnswer === "yes" || recordedAnswer === "no"
                            ? recordedAnswer as "yes" | "no"
                            : null)
                        : recordedAnswer,
                note: task.checklist_evidence?.[itemId]?.note || "",
                photoAttached: Boolean(task.checklist_evidence?.[itemId]?.photoUrl),
                assignedUserId: personal?.user_id??item.assignedUserId,
                assignedUserName: personal?.user_name??item.assignedUserName,
            };
        });
        return items.length > 0 ? items : null;
    }, [task,workerMode,structuredById,currentUser.id,ownAnswers]);

    const isParsedChecklist = useMemo(() => {
        return !!parseDescriptionChecklist();
    }, [parseDescriptionChecklist]);

    const resolveChecklist = useCallback((previous: ChecklistItem[] = []) => {
        const parsed = parseDescriptionChecklist();
        if (parsed) return mergeParsedChecklist(parsed, previous);
        return workerMode?[]:readStoredChecklist(task.id);
    }, [task.id, parseDescriptionChecklist,workerMode]);

    const checklistSourceKey = useMemo(() => getChecklistSourceKey(task)+(workerMode?JSON.stringify([...ownAnswers]):""), [task,workerMode,ownAnswers]);
    const [checklistStore, setChecklistStore] = useState<ChecklistStore>(() => ({
        sourceKey: checklistSourceKey,
        items: resolveChecklist(),
    }));
    const checklist = checklistStore.sourceKey === checklistSourceKey
        ? checklistStore.items
        : resolveChecklist(checklistStore.items);
    const setChecklist = useCallback((update: React.SetStateAction<ChecklistItem[]>) => {
        setChecklistStore(prev => {
            const currentItems = prev.sourceKey === checklistSourceKey
                ? prev.items
                : resolveChecklist(prev.items);
            const nextItems = typeof update === "function"
                ? (update as (current: ChecklistItem[]) => ChecklistItem[])(currentItems)
                : update;

            return {
                sourceKey: checklistSourceKey,
                items: nextItems,
            };
        });
    }, [checklistSourceKey, resolveChecklist]);

    const completedCount = useMemo(() => checklist.filter(item => item.answer !== null).length, [checklist]);
    const totalCount = checklist.length;

    const ownChecklistItems = useMemo(() => {
        if (!currentUser?.id) return checklist;
        if(workerMode)return checklist.filter(item=>!item.assignedUserId||item.assignedUserId===currentUser.id);
        const assignedToUser = checklist.filter(item => item.assignedUserId === currentUser.id);
        if (assignedToUser.length > 0) return assignedToUser;
        const hasExplicitAssignments = checklist.some(item => item.assignedUserId);
        if (task.user_id === currentUser.id) {
            return hasExplicitAssignments
                ? checklist.filter(item => !item.assignedUserId)
                : checklist;
        }
        return [];
    }, [checklist, currentUser, task.user_id,workerMode]);

    const ownCompletedCount = useMemo(() => ownChecklistItems.filter(item => item.answer !== null).length, [ownChecklistItems]);
    const ownTotalCount = ownChecklistItems.length;
    const visibleCompletedCount = ownTotalCount > 0 ? ownCompletedCount : completedCount;
    const visibleTotalCount = ownTotalCount > 0 ? ownTotalCount : totalCount;

    const filteredItems = useMemo(() => {
        return [...filterVisibleChecklistItems(checklist, hideCompleted)];
    }, [checklist, hideCompleted]);

    const categoryItems = useMemo(() => {
        return filteredItems.filter(item => getCategoryForItem(item.question) === activeCategory);
    }, [filteredItems, activeCategory]);

    // --- Handlers ---

    const handleAnswer = async (itemId: string, answer: "yes" | "no") => {
        if (!isCurrentTaskSessionActive) {
            toast.error(dict.tech.toast_start_first);
            return;
        }
        if(workerMode){
            if(workforce?.key!==allocationKey||workforce.failed){toast.error("No se pudo comprobar tu reparto de tareas. Actualiza el trabajo antes de continuar.");return;}
            if(workforce.rows.length){
                const id=Number(itemId.replace("item_","")),targets=ownAllocationRows.filter(row=>row.tasks.some(step=>step.id===id));
                if(!targets.length){toast.error("Esta tarea no está repartida a tu ficha de trabajador.");return;}
                try{let rows:SpaceWorker[]=workforce.rows;for(const target of targets)rows=await spaceWorkforce(task.id,target.id,id,true,answer);setWorkforce({key:allocationKey,rows,failed:false});onStatusUpdate();}catch(cause){toast.error(cause instanceof Error?cause.message:"No se pudo guardar tu respuesta.");}
                return;
            }
        }

        const item = checklist.find(i => i.id === itemId);
        if (item && item.assignedUserId && item.assignedUserId !== currentUser?.id) {
            toast.error(`Este elemento está asignado a otro compañero (${item.assignedUserName || `ID: ${item.assignedUserId}`})`);
            return;
        }

        const updated = checklist.map(item =>
            item.id === itemId ? { ...item, answer } : item
        );
        setChecklist(updated);
        const restoreFailedAnswer = () => {
            // Never present an optimistic answer as completed when the API
            // rejected it: that would make the task modal disagree with the
            // operational dashboard and with the persisted task state.
            setChecklist(checklist);
            onStatusUpdate();
            toast.error("No se pudo guardar el requisito. Inténtalo de nuevo.");
        };

        const isStructured = itemId.startsWith("item_");
        if (isStructured) {
            try {
                await TaskService.updateChecklistItem(
                    task.id,
                    Number(itemId.slice("item_".length)),
                    { completed: true, answer },
                );
                onStatusUpdate();
            } catch (error) {
                console.error("Error updating structured checklist answer", error);
                restoreFailedAnswer();
            }
            return;
        }

        const isParsed = itemId.startsWith("parsed_");
        if (isParsed && task.description) {
            try {
                const lines = task.description.split("\n");
                let parsedCount = 0;
                const newLines = lines.map(line => {
                    const match = line.match(/^(\s*[-*]?\s*\[)\s*([xX\s])\s*(\]\s*)(.+)$/);
                    if (match) {
                        const currentId = `parsed_${parsedCount + 1}`;
                        parsedCount++;
                        const updatedItem = updated.find(i => i.id === currentId);
                        if (updatedItem) {
                            const box = updatedItem.answer === "yes" ? "x" : " ";
                            return `${match[1]}${box}${match[3]}${match[4]}`;
                        }
                    }
                    return line;
                });
                const newDescription = newLines.join("\n");
                const evidence = {
                    ...(task.checklist_evidence || {}),
                    [itemId]: {
                        ...(task.checklist_evidence?.[itemId] || {}),
                        answer,
                    },
                };
                await TaskService.updateTaskItem(task.id, {
                    description: newDescription,
                    checklist_evidence: evidence,
                });
                onStatusUpdate();
            } catch (error) {
                console.error("Error updating parsed checklist answer in backend", error);
                restoreFailedAnswer();
            }
        } else {
            localStorage.setItem(`workhive_checklist_task_${task.id}`, JSON.stringify(updated));
        }
    };

    const handleNoteChange = (itemId: string, note: string) => {
        const updated = checklist.map(item =>
            item.id === itemId ? { ...item, note } : item
        );
        setChecklist(updated);
        if (!workerMode) localStorage.setItem(`workhive_checklist_task_${task.id}`, JSON.stringify(updated));
    };

    const persistChecklistNote = async (itemId: string, note: string) => {
        if (!itemId.startsWith("item_") || !note.trim()) return false;
        try {
            await TaskReportService.createChecklistNote(
                task.id,
                Number(itemId.slice("item_".length)),
                note.trim(),
            );
            onStatusUpdate();
            return true;
        } catch {
            toast.error("No se pudo guardar la nota");
            return false;
        }
    };

    const handleChecklistPhoto = async (
        itemId: string,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!isCurrentTaskSessionActive) {
            toast.error(dict.tech.toast_photos_first);
            return;
        }
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingChecklistItem(itemId);
        try {
            const uploaded = await UploadService.uploadFile(file, "location");
            if (!itemId.startsWith("item_")) {
                throw new Error("Checklist item is not synchronized");
            }
            await TaskReportService.createChecklistPhoto(
                task.id,
                Number(itemId.slice("item_".length)),
                uploaded.url,
                file.name,
            );
            setChecklist(current => current.map(item => (
                item.id === itemId ? { ...item, photoAttached: true } : item
            )));
            onStatusUpdate();
            toast.success("Foto guardada en la tarea");
        } catch {
            toast.error("No se pudo guardar la foto");
        } finally {
            setUploadingChecklistItem(null);
            event.target.value = "";
        }
    };

    const handleResetChecklist = async () => {
        if (workerMode) return;
        const structuredItems = checklist.filter(item => item.id.startsWith("item_"));
        if (structuredItems.length > 0) {
            try {
                await Promise.all(structuredItems.map(item =>
                    TaskService.updateChecklistItem(
                        task.id,
                        Number(item.id.slice("item_".length)),
                        { completed: false, answer: null },
                    )
                ));
                toast.success(dict.tech.toast_checklist_reset || "Checklist reiniciado");
                onStatusUpdate();
            } catch (error) {
                console.error("Error resetting structured checklist", error);
            }
            return;
        }
        if (isParsedChecklist && task.description) {
            try {
                const lines = task.description.split("\n");
                const newLines = lines.map(line => {
                    const match = line.match(/^(\s*[-*]?\s*\[)\s*([xX\s])\s*(\]\s*)(.+)$/);
                    if (match) {
                        return `${match[1]} ${match[3]}${match[4]}`;
                    }
                    return line;
                });
                const newDescription = newLines.join("\n");
                await TaskService.updateTaskItem(task.id, { description: newDescription });
                toast.success(dict.tech.toast_checklist_reset || "Checklist reiniciado");
                onStatusUpdate();
            } catch (error) {
                console.error("Error resetting checklist description on backend", error);
            }
        } else {
            setChecklist([]);
            localStorage.removeItem(`workhive_checklist_task_${task.id}`);
            toast.success(dict.tech.toast_checklist_reset || "Checklist reiniciado");
        }
    };

    const handleAddChecklistItem = async (question: string, assigneeId: number): Promise<boolean> => {
        if (workerMode) return false;
        const assignee = availableAssignees.find(user => user.id === assigneeId);
        if (!question.trim()) return false;
        if (!assignee) {
            toast.error("Selecciona quién realizará este trabajo extra.");
            return false;
        }

        try {
            const desc = task.description || "";
            const separator = desc.endsWith("\n") || desc === "" ? "" : "\n";
            const assigneeName = assignee.full_name || assignee.email;
            const newDescription = `${desc}${separator}[ ] ${question.trim()} (@${assignee.id}:${assigneeName}:pending)`;
            await TaskService.updateTaskItem(task.id, { description: newDescription });
            toast.success(dict.tech.toast_checklist_item_added || "Elemento añadido");
            onStatusUpdate();
            return true;
        } catch (error) {
            console.error("Error adding checklist item in backend", error);
            toast.error("Error al añadir");
            return false;
        }
    };

    return {
        checklist,
        isParsedChecklist,
        completedCount,
        totalCount,
        ownChecklistItems,
        ownCompletedCount,
        ownTotalCount,
        visibleCompletedCount,
        visibleTotalCount,
        filteredItems,
        categoryItems,
        hideCompleted,
        setHideCompleted,
        expandedItem,
        setExpandedItem,
        activeCategory,
        setActiveCategory,
        uploadingChecklistItem,
        availableAssignees,
        handleAnswer,
        handleNoteChange,
        persistChecklistNote,
        handleChecklistPhoto,
        handleResetChecklist,
        handleAddChecklistItem,
        getCategoryForItem,
    };
}
