import test from "node:test";
import assert from "node:assert/strict";
import {applyStaffRoster,type StaffRoster} from "../domain/tasks/overview-staff-roster.ts";
import {buildOperationsOverview,overviewRange} from "../domain/tasks/operations-overview.ts";
import type {TaskItem} from "../types/user.ts";
import {reportValue} from "./report-value.ts";
test("employee shifts include people without software accounts and do not double-count linked access",()=>{
 const now=new Date("2026-11-17T09:00:00Z");
 const task={id:1,title:"Centro",location_id:1,status:"pending",scheduled_start_at:now.toISOString(),user_id:7} as TaskItem;
 const data=buildOperationsOverview([task],overviewRange("today","",now),now);
 const row={id:1,employee_id:1,effective_employee_id:1,employee_name:"María",planned_employee_name:"María",account_user_id:7,task_id:1,location_id:1,starts_at:now.toISOString(),ends_at:now.toISOString(),coverage:"Asignado"} satisfies StaffRoster;
 const result=applyStaffRoster(data,[row,{...row,id:2,employee_id:2,effective_employee_id:2,employee_name:"Juan",account_user_id:null}]);
 assert.equal(result.team.length,2);
 assert.equal(result.team.find(person=>person.id===-2)?.name,"Juan");
 assert.equal(result.team.find(person=>person.id===7)?.tasks.length,1);
});
test("report cells use Spanish state labels and explicit company-local dates",()=>{
 const dates=new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Madrid"});
 assert.equal(reportValue("status","pending",dates),"Pendiente");
 assert.equal(reportValue("scheduled","2026-11-17T08:00:00Z",dates),dates.format(new Date("2026-11-17T08:00:00Z")));
 assert.equal(reportValue("completed",null,dates),"—");
});
