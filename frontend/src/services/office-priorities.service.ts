import { StaffService } from "@/services/staff.service";
import { readAbsences } from "@/services/staff-absence.service";
import { QualityService } from "@/services/quality.service";
export type OfficePriority = {id:string;title:string;detail:string;href:string;group:"people"|"documents"|"absences"|"quality"};
const calendarDay=new Intl.DateTimeFormat("en-CA");
export const OfficePrioritiesService={
    async read(people:boolean,quality:boolean):Promise<{rows:OfficePriority[];asOf:string;canViewIncidents:boolean}>{
        const canViewIncidents=quality&&(await QualityService.getAccess()).sections.incidents.can_read;
        const [staff,absences,incidents]=await Promise.all([people?StaffService.list():Promise.resolve([]),people?readAbsences():Promise.resolve([]),canViewIncidents?QualityService.getIncidents():Promise.resolve([])]);
        const now=new Date(),today=calendarDay.format(now),until=new Date(now.getTime()+30*86400000).toISOString().slice(0,10),staffNames=new Map(staff.map(person=>[person.id,person.name]));
        const rows:OfficePriority[]=staff.filter(person=>person.profile.state!=="Baja").map(person=>({id:"person-"+person.id,title:person.name,detail:person.position,href:"/dashboard/plantilla/trabajadores",group:"people"}));
        for(const person of staff)for(const document of person.profile.documents??[])if(document.expires_on&&document.expires_on<=until)rows.push({id:"document-"+person.id+"-"+document.name,title:person.name,detail:document.name+" · caduca "+document.expires_on,href:"/dashboard/plantilla/documentacion",group:"documents"});
        for(const absence of absences)if(absence.starts_on<=today&&absence.ends_on>=today&&!absence.substitute_id)rows.push({id:"absence-"+absence.id,title:staffNames.get(absence.employee_id)??"Trabajador",detail:"Ausencia activa · falta asignar sustituto",href:"/dashboard/plantilla/ausencias",group:"absences"});
        for(const incident of incidents)if(incident.status==="open"||incident.status==="in_progress")rows.push({id:"incident-"+incident.id,title:incident.title,detail:incident.status==="open"?"Incidencia abierta":"Incidencia en seguimiento",href:"/dashboard/quality",group:"quality"});
        return {rows,asOf:now.toISOString(),canViewIncidents};
    },
};
