"use client";
import {useEffect,useState} from "react";
import {useUser} from "@/lib/user-context";
import {CompanyPlanAccessService} from "@/services/company-plan-access.service";
const empty=new Set<string>();
export function useCompanyModules(){
 const {user}=useUser();const key=user?.id+":"+user?.company_id;
 const [data,setData]=useState<{key:string;enabled:Set<string>;error:string}|null>(null);
 useEffect(()=>{if(!user?.company_id)return;let active=true;CompanyPlanAccessService.getCurrentEntitlements().then(value=>{if(active)setData({key,enabled:new Set(value.entitlements.flatMap(item=>item.value_type==="boolean"&&item.value===true?[item.code]:[])),error:""});}).catch(e=>{if(active)setData({key,enabled:empty,error:e.message});});return()=>{active=false;};},[key,user?.company_id]);
 return data?.key===key?{enabled:data.enabled,error:data.error,loading:false}:{enabled:empty,error:"",loading:true};
}
