"use client";
import {FormSelect} from "@/components/ui/form-select";
import {useDictionary} from "@/lib/dictionary-context";
import {useEffect,useState} from "react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {readConsolidation,saveConsolidation,type RegionalSettings as Settings} from "@/services/consolidation.service";

export function RegionalSettings() {
    const {setLocale}=useDictionary();
    const [companies,setCompanies]=useState<{id:number;name:string}[]>([]);
    const [settings,setSettings]=useState<Settings|null>(null);
    const [message,setMessage]=useState("");
    useEffect(()=>{void readConsolidation<{id:number;name:string}[]>("companies").then(setCompanies).catch(()=>setCompanies([]));},[]);
    useEffect(()=>{void readConsolidation<Settings>("settings").then(setSettings).catch(e=>setMessage(e.message));},[]);
    async function save() {
        if(!settings)return;
        try{await saveConsolidation("settings",{parent_company_id:settings.parent_company_id,country:settings.country,language:settings.language,timezone:settings.timezone},"PUT");setLocale(settings.language);setMessage("Configuración guardada.");}
        catch(e){setMessage(e instanceof Error?e.message:"No se pudo guardar.");}
    }
    return <details className="space-y-3 rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Configuración regional de la empresa actual</summary>
        {settings&&<form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void save();}}>
            <label>Sociedad matriz<FormSelect aria-label={"Sociedad matriz"}  value={settings.parent_company_id??""} onValueChange={selectedOptionValue=>setSettings({...settings,parent_company_id:selectedOptionValue?Number(selectedOptionValue):null})}><option value="">Empresa independiente</option>{companies.flatMap(c=>c.id!==settings.company_id?[<option key={c.id} value={c.id}>{c.name}</option>]:[])}</FormSelect></label>
            <label>País (ISO)<Input required pattern="[A-Z]{2}" maxLength={2} value={settings.country} onChange={e=>setSettings({...settings,country:e.target.value.toUpperCase()})}/></label>
            <label>Zona horaria<Input required value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})}/></label>
            <label>Idioma<FormSelect aria-label={"Idioma"}  value={settings.language} onValueChange={selectedOptionValue=>setSettings({...settings,language:selectedOptionValue as "es"|"en"})}><option value="es">Español</option><option value="en">English</option></FormSelect></label>
            <Button>Guardar configuración</Button>
        </form>}
        {message&&<p role="status">{message}</p>}
    </details>;
}
