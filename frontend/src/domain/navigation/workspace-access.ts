const requirements:Record<string,string|readonly string[]|{all:readonly string[]}>={
 "/dashboard/documents/centros":"locations.read",
 "/dashboard/calendar":"work.read","/dashboard/tasks":"work.read","/dashboard/planificar":"work.manage","/dashboard/services":"work.manage","/dashboard/work-orders":"work.read","/dashboard/alertas":"work.manage","/dashboard/task-reports":"work.read","/dashboard/handover":"work.read","/dashboard/additional-work":"finance.read",
 "/dashboard/locations":"locations.read","/dashboard/documents":["locations.read","clients.read","labor_costs.read"],"/dashboard/assets":"locations.read","/dashboard/clients":"clients.read","/dashboard/commercial":"commercial.follow_ups.read",
 "/dashboard/plantilla/trabajadores":"labor_costs.read","/dashboard/plantilla/equipos":"labor_costs.read","/dashboard/plantilla/ausencias":"labor_costs.read","/dashboard/plantilla/turnos":"labor_costs.read","/dashboard/plantilla/documentacion":"labor_costs.read",
 "/dashboard/live-work":"time.read","/dashboard/time-corrections":["time.read","time.manage","time.approve"],"/dashboard/control-servicio":"time.read","/dashboard/offline-review":"time.approve","/dashboard/mi-jornada":"time.manage",
 "/dashboard/invoices":"finance.read","/dashboard/invoice-summary":"finance.read","/dashboard/quotes":"finance.read","/dashboard/contracts":"finance.read","/dashboard/expenses":"finance.read","/dashboard/currencies":"finance.read","/dashboard/consolidation":"finance.read","/dashboard/analytics":"finance.read","/dashboard/fiscal-summary":"finance.read","/dashboard/fiscal-calendar":"finance.read","/dashboard/labor-costs":"labor_costs.read",
 "/dashboard/inventory":"inventory.read","/dashboard/resources":"inventory.read","/dashboard/subcontracts":{all:["inventory.read","finance.read"]},
 "/dashboard/quality":["quality.templates.read","quality.inspections.read","quality.incidents.read","quality.complaints.read"],
 "/dashboard/organization":["access.members.read","access.profiles.read","organization.departments.read","organization.teams.read"],"/dashboard/portals":"access.members.manage","/dashboard/api-access":"access.members.manage","/dashboard/automations":"access.members.manage","/dashboard/data-import":["clients.manage","locations.manage","labor_costs.manage","work.manage"],
};
export function navigationCapabilityAllowed(path:string,permissions:Readonly<Record<string,boolean>>):boolean{
 const base=Object.keys(requirements).filter(href=>path===href||path.startsWith(href+"/")).sort((a,b)=>b.length-a.length)[0];if(!base)return true;const rule=requirements[base];if(typeof rule==="string")return permissions[rule]===true;if("all" in rule)return rule.all.every(code=>permissions[code]===true);return rule.some(code=>permissions[code]===true);
}
export function initialWorkerRouteAllowed(path:string,initialWorker:boolean):boolean{
 return !initialWorker||!["/dashboard/work-orders","/dashboard/custom-reports"].some(base=>path===base||path.startsWith(base+"/"));
}
