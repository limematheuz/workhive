import type { TaskItem } from "@/types/user";
import { getTaskScheduleDate, toTaskPlanningDateInput } from "./task-schedule.ts";

export function workerTaskProjection(task:TaskItem):TaskItem {
    return {...task,price:null,quantity:null,billing_price_snapshot:null,billing_quantity_snapshot:null,billing_unit_snapshot:null,billing_pricing_mode_snapshot:null};
}
export function workerChecklistProgress(task:TaskItem,userId:number) {
    const items=(task.checklist_items??[]).filter(item=>!item.assignments?.length||item.assignments.some(row=>row.user_id===userId));
    return {total:items.length,done:items.filter(item=>item.completed||item.assignments?.some(row=>row.user_id===userId&&row.status==="completed")).length};
}
export function workerTaskOnDay(task:TaskItem,date:string) {
    return toTaskPlanningDateInput(task.scheduled_start_at??task.due_at)===date;
}
export function sortWorkerTasks(tasks:TaskItem[]) {
    const planned=(task:TaskItem)=>task.scheduled_start_at||task.due_at?getTaskScheduleDate(task)?.getTime()??Number.MAX_SAFE_INTEGER:Number.MAX_SAFE_INTEGER;
    return [...tasks].sort((left,right)=>planned(left)-planned(right)||left.id-right.id);
}
