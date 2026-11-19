import test from "node:test";
import assert from "node:assert/strict";
import { taskCompletedThisWeek, taskDeadlinePassed } from "../domain/tasks/task-summary.ts";
import { taskReschedulePatch } from "../domain/tasks/task-reschedule.ts";
import { taskViewFilter } from "../domain/tasks/task-view-filters.ts";
import type { TaskItem } from "../types/user.ts";
const task=(data:Partial<TaskItem>)=>({id:1,status:"pending",is_invoiced:false,...data}) as TaskItem;

test("overdue is an open deadline condition, including work in progress but excluding completed and unscheduled",()=>{
    const now=new Date(2026,10,19,12);
    assert.equal(taskDeadlinePassed(task({status:"progress",scheduled_start_at:new Date(2026,10,19,8).toISOString(),due_at:new Date(2026,10,19,13).toISOString()}),now),false);
    assert.equal(taskDeadlinePassed(task({status:"review",due_at:new Date(2026,10,19,11).toISOString()}),now),true);
    assert.equal(taskDeadlinePassed(task({due_at:"2026-11-19"}),now),false);
    assert.equal(taskDeadlinePassed(task({status:"completed",due_at:"2026-11-18"}),now),false);
    assert.equal(taskDeadlinePassed(task({scheduled_start_at:new Date(2026,10,18,8).toISOString()}),now),false);
    assert.equal(taskDeadlinePassed(task({created_at:"2025-01-01"}),now),false);
});
test("weekly completions respect local Monday boundary and need a real completion timestamp",()=>{
    const now=new Date(2026,10,23,12);
    assert.equal(taskCompletedThisWeek(task({status:"completed",date_done:new Date(2026,10,22,23,59).toISOString()}),now),false);
    assert.equal(taskCompletedThisWeek(task({status:"completed",date_done:new Date(2026,10,23,0).toISOString()}),now),true);
    assert.equal(taskCompletedThisWeek(task({status:"completed",created_at:now.toISOString()}),now),false);
    assert.equal(taskCompletedThisWeek(task({status:"completed",date_done:new Date(2026,10,24).toISOString()}),now),false);
});
test("bulk reschedule preserves interval and never mutates creation, staff, checklist or billing",()=>{
    const original=task({scheduled_start_at:"2026-11-19T08:00:00Z",due_at:"2026-11-19T10:30:00Z",user_id:7,created_at:"2026-01-01T00:00:00Z"});
    assert.deepEqual(taskReschedulePatch(original,new Date("2026-11-20T14:00:00Z")),{scheduled_start_at:"2026-11-20T14:00:00.000Z",due_at:"2026-11-20T16:30:00.000Z"});
    assert.throws(()=>taskReschedulePatch({...original,status:"completed"},new Date()),/estado actual/);
    assert.throws(()=>taskReschedulePatch({...original,is_invoiced:true},new Date()),/estado actual/);
    assert.throws(()=>taskReschedulePatch(task({due_at:"2026-11-19"}),new Date()),/duración no está definida/);
});
test("shared task filters reject partial IDs, unknown states and unsupported filters",()=>{
    assert.equal(taskViewFilter("location","12x"),"");
    assert.equal(taskViewFilter("worker","-5"),"");
    assert.equal(taskViewFilter("location","9007199254740992"),"");
    assert.equal(taskViewFilter("location","12"),"12");
    assert.equal(taskViewFilter("status","admin"),"");
    assert.equal(taskViewFilter("attention","completed-week"),"completed-week");
});
