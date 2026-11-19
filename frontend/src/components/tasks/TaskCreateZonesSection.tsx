"use client";
import {useEffect,useState} from "react";
import {Input} from "@/components/ui/input";
import {SpaceWorkforceEditor} from "@/components/operations/SpaceWorkforceEditor";
import type {LocationZone} from "@/services/location.service";
import {workforceChoices,type SpaceAllocation,type WorkforceChoices} from "@/services/service-planning.service";
interface TaskCreateZonesSectionProps{
 locationId:number;zones:LocationZone[];loading:boolean;selectedZoneIds:number[];setSelectedZoneIds:(ids:number[])=>void;
 selectedSpaceTaskTemplateIds:number[];setSelectedSpaceTaskTemplateIds:(ids:number[])=>void;
}
export function TaskCreateZonesSection({locationId,zones,loading,selectedZoneIds,setSelectedZoneIds,selectedSpaceTaskTemplateIds,setSelectedSpaceTaskTemplateIds}:TaskCreateZonesSectionProps){
 const [allocations,setAllocations]=useState<SpaceAllocation[]>([]),[choices,setChoices]=useState<WorkforceChoices>({people:[],crews:[]}),[error,setError]=useState("");
 useEffect(()=>{let active=true;workforceChoices(locationId).then(rows=>{if(active)setChoices(rows);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[locationId]);
 const selectedTaskIds=new Set(selectedSpaceTaskTemplateIds);
 const allocationsBySpace=new Map(allocations.map(item=>[item.space_id,item]));
 const zonesById=new Map(zones.map(zone=>[zone.id,zone]));
 const value=selectedZoneIds.map(id=>{const previous=allocationsBySpace.get(id);return{space_id:id,employee_ids:previous?.employee_ids??[],crew_id:previous?.crew_id??null,planned_minutes:previous?.planned_minutes,
  task_ids:(zonesById.get(id)?.tasks??[]).flatMap(task=>task.id&&selectedTaskIds.has(task.id)?[task.id]:[])};});
 if(loading)return <p className="text-xs text-muted-foreground">Cargando espacios y tareas…</p>;
 if(!zones.length)return null;
 return <><Input type="hidden" name="space_allocations" value={JSON.stringify(value)}/><SpaceWorkforceEditor spaces={zones.map(zone=>({...zone,space_type:zone.zone_type}))} choices={choices} value={value} onChange={rows=>{setAllocations(rows);setSelectedZoneIds(rows.map(row=>row.space_id));setSelectedSpaceTaskTemplateIds(rows.flatMap(row=>row.task_ids));}}/>{error&&<p role="alert" className="text-xs text-orange-700">{error}</p>}</>;
}
