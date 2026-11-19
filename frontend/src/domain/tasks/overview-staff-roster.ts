import type {OperationsOverview} from "./operations-overview.ts";
export type StaffRoster={space_progress?:{space_id:number|null;space_name:string;checklist_ids?:number[];total:number;done:number}[];id:number;employee_id:number;effective_employee_id:number|null;employee_name:string|null;planned_employee_name:string;account_user_id:number|null;planned_account_user_id?:number|null;task_id:number|null;location_id:number;starts_at:string;ends_at:string;coverage:string};
export function rosterWorkerId(row:StaffRoster){return row.account_user_id??-(row.effective_employee_id??row.employee_id);}
export function applyStaffRoster(data:OperationsOverview,roster:StaffRoster[]):OperationsOverview{
 const people=new Map(data.team.map(person=>[person.id,person]));
 const plannedById=new Map(data.planned.map(task=>[task.id,task]));
 const covered=new Set<number>();
 for(const row of roster){
  const original=row.planned_account_user_id;
  if(original==null||original===row.account_user_id)continue;
  const person=people.get(original);
  if(!person)continue;
  const tasks=person.tasks.filter(task=>task.id!==row.task_id);
  if(tasks.length)people.set(original,{...person,tasks});
  else if(!roster.some(other=>other.effective_employee_id!==null&&other.account_user_id===original))people.delete(original);
 }
 for(const row of roster){
  if(row.effective_employee_id===null)continue;
  const id=rosterWorkerId(row),person=people.get(id)??{id,name:row.employee_name,tasks:[]};
  const task=row.task_id===null?undefined:plannedById.get(row.task_id);
  if(task&&!person.tasks.some(item=>item.id===task.id))person.tasks=[...person.tasks,task];
  if(task)covered.add(task.id);
  people.set(id,person);
 }
 return {...data,team:[...people.values()],unassigned:data.unassigned.filter(task=>!covered.has(task.id))};
}
