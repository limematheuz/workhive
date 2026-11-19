import assert from "node:assert/strict";
import test from "node:test";
import type {TaskItem} from "../types/user.ts";
import {workerTaskProjection,workerChecklistProgress,workerTaskOnDay,sortWorkerTasks} from "../domain/tasks/worker-day.ts";
const task=(extra:Partial<TaskItem>={}):TaskItem=>({id:1,title:"Servicio",unit:"servicio",location_id:1,user_id:7,status:"accepted",priority:"medium",is_invoiced:false,created_at:"2026-11-17T07:00:00Z",updated_at:"2026-11-17T07:00:00Z",...extra});

test("worker cache excludes billing values even for an administrator using the worker app",()=>{
 const source=task({price:13579,quantity:3,billing_price_snapshot:24680,billing_quantity_snapshot:4,billing_pricing_mode_snapshot:"hourly",billing_unit_snapshot:"h"});
 const projected=workerTaskProjection(source);
 for(const field of ["price","quantity","billing_price_snapshot","billing_quantity_snapshot","billing_pricing_mode_snapshot","billing_unit_snapshot"] as const)assert.equal(projected[field],null);
 assert.equal(projected.id,source.id);assert.equal(projected.title,source.title);assert.equal(source.price,13579);
});
test("personal task count includes shared unassigned steps and own completion before the whole team finishes",()=>{
 const row=task({checklist_items:[
  {id:1,position:1,text:"Propia",completed:false,assignments:[{user_id:7,user_name:"Ana",status:"completed"},{user_id:8,user_name:"Luis",status:"accepted"}]},
  {id:2,position:2,text:"Otra persona",completed:false,assignments:[{user_id:8,user_name:"Luis",status:"accepted"}]},
  {id:3,position:3,text:"Común",completed:true,assignments:[]},
 ]});
 assert.deepEqual(workerChecklistProgress(row,7),{total:2,done:2});
 assert.deepEqual(workerChecklistProgress(row,8),{total:3,done:1});
});
test("worker day retains legacy date-only tasks without shifting their selected calendar day",()=>{
 assert.equal(workerTaskOnDay(task({scheduled_start_at:"2026-11-17T00:00:00Z"}),"2026-11-17"),true);
 assert.equal(workerTaskOnDay(task({scheduled_start_at:"2026-11-17T00:00:00Z"}),"2026-11-18"),false);
 assert.equal(workerTaskOnDay(task({scheduled_start_at:null,due_at:null}),"2026-11-17"),false);
});
test("undated work is placed after scheduled work without mutating the source list",()=>{
 const rows=[task({id:3}),task({id:2,scheduled_start_at:"2026-11-18T08:00:00Z"}),task({id:1,scheduled_start_at:"2026-11-17T08:00:00Z"})];
 assert.deepEqual(sortWorkerTasks(rows).map(row=>row.id),[1,2,3]);assert.deepEqual(rows.map(row=>row.id),[3,2,1]);
});
