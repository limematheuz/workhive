import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type ManagementInsights={period:"month"|"year";month:string;timezone:string;starts_at:string;ends_at:string;as_of:string;
 finance:{realized_exchange_difference:string;revenue_base:string;registered_expense_and_material_cost:string;recorded_balance:string;previous_revenue_base:string;revenue_change_percent:string|null;received_with_tax:string;outstanding_with_tax:string;unpaid_invoice_count:number;unknown_material_consumptions:number;clients:{client_id:number;client_name:string;invoice_count:number;revenue_base_amount:string;direct_cost_base_amount:string;known_margin_amount:string;known_margin_percentage:string|null}[]};
 operations:{scheduled_jobs:number;current_statuses:Record<string,number>;unique_locations:number;scheduled_people:number;planned_person_hours:string;completed_unbilled:number}|null;
 time:{closed_person_hours:string;approved_person_hours:string;closed_sessions:number;recorded_labor_cost:string;sessions_without_labor_cost:number;completed_jobs_without_hours:number;staff_assignments_without_hours:number}|null;
 quality:{open_incidents:number}|null;pipeline:Record<string,number>|null;};
export async function readManagementInsights(month:string,period:"month"|"year"):Promise<ManagementInsights>{
 const query=new URLSearchParams({period});if(month)query.set("month",month);
 const response=await apiFetch("/api/v1/management-insights?"+query,{cache:"no-store"});await assertApiResponseOk(response,"No se pudieron cargar los análisis de empresa.");return response.json();
}
