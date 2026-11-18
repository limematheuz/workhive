import {useEffect,useState} from "react";
import {staffRoster} from "@/services/staff-roster.service";
import type {StaffRoster} from "@/domain/tasks/overview-staff-roster";
export function useOverviewRoster(start:string,end:string,company:number|null|undefined,revision:number){
 const [result,setResult]=useState<{key:string;rows:StaffRoster[];error:string}|null>(null);
 const key=`${company}:${start}:${end}`;
 useEffect(()=>{let active=true;staffRoster(start,end).then(rows=>{if(active)setResult({key,rows,error:""});}).catch(error=>{if(active)setResult({key,rows:[],error:error.message});});return()=>{active=false;};},[start,end,company,revision,key]);
 return result?.key===key?{...result,loading:false}:{rows:[],error:"",loading:true};
}
