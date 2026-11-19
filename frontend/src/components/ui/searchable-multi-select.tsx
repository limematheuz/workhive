"use client";
import {useMemo} from "react";
import {X} from "lucide-react";
import {SearchableSelect,type SelectOption} from "@/components/ui/searchable-select";
import {Button} from "@/components/ui/button";
import {useDialogFormGuardMark} from "@/components/ui/dialog-form-guard";
export type SearchableMultiSelectProps={options:readonly SelectOption[];value:readonly string[];onValueChange:(value:string[])=>void;"aria-label":string;placeholder?:string;disabled?:boolean;maxSelected?:number};
function selectionSnapshot(options:readonly SelectOption[],value:readonly string[]){
 const chosen=Array.from(new Set(value)),selected=new Set(chosen),byValue=new Map(options.map(option=>[option.value,option]));
 return {chosen,selected,byValue,available:options.filter(option=>!selected.has(option.value))};
}
export function SearchableMultiSelect({options,value,onValueChange,"aria-label":label,placeholder="Buscar y añadir…",disabled=false,maxSelected}:SearchableMultiSelectProps){
 const markDirty=useDialogFormGuardMark();
 const {chosen,selected,byValue,available}=useMemo(()=>selectionSnapshot(options,value),[options,value]);
 const atLimit=maxSelected!==undefined&&chosen.length>=maxSelected;
 return <div className="space-y-2"><SearchableSelect aria-label={label} value="" onValueChange={next=>{if(!next||selected.has(next)||disabled||atLimit)return;onValueChange([...chosen,next]);}} options={available} placeholder={placeholder} disabled={disabled||atLimit}/>
  {chosen.length>0&&<ul aria-label={label+" seleccionados"} className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">{chosen.map(id=><li key={id} className="flex max-w-full items-center gap-1 rounded-lg border bg-muted/30 py-1 pl-2 text-xs"><span className="min-w-0 break-words" title={byValue.get(id)?.label??id}>{byValue.get(id)?.label??id}</span><Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" disabled={disabled} aria-label={"Quitar "+(byValue.get(id)?.label??id)} onClick={event=>{markDirty(event.currentTarget);onValueChange(chosen.filter(value=>value!==id));}}><X aria-hidden="true" className="size-3"/></Button></li>)}</ul>}
  {maxSelected!==undefined&&<p role={atLimit?"status":undefined} className={"text-xs "+(atLimit?"text-orange-700 dark:text-orange-300":"text-muted-foreground")}>{chosen.length}/{maxSelected} seleccionados{atLimit?" · Quita una selección para añadir otra.":""}</p>}
 </div>;
}
