"use client";
import {useEffect,useState} from "react";
import {Workflow} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Checkbox} from "@/components/ui/checkbox";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {operationsAutomation,type OperationsAutomation} from "@/services/operations-automation.service";

export default function AutomationsPage(){
    const [settings,setSettings]=useState<OperationsAutomation|null>(null);
    const [error,setError]=useState("");
    const [busy,setBusy]=useState(false);
    useEffect(()=>{void operationsAutomation().then(setSettings).catch(e=>setError(e.message));},[]);
    async function save(run=false){
        if(!settings)return;
        setBusy(true);setError("");
        try{
            const {recurring,documents,incidents,horizon_days}=settings;
            setSettings(await operationsAutomation("PUT",{recurring,documents,incidents,horizon_days}));
            if(run)setSettings(await operationsAutomation("POST",{},"/run"));
        }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}
        finally{setBusy(false);}
    }
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={Workflow} title="Automatizaciones" subtitle="Las automatizaciones activadas se comprueban cada minuto."/>
        {settings&&<form className="space-y-4 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void save();}}>
            <label className="flex gap-2"><Checkbox disabled={busy} checked={settings.recurring} onCheckedChange={value=>setSettings({...settings,recurring:value === true})}/>Generar ejecuciones de servicios recurrentes</label>
            <label>Anticipación en días<Input required type="number" min="1" max="30" value={settings.horizon_days} onChange={e=>setSettings({...settings,horizon_days:Number(e.target.value)})}/></label>
            <label className="flex gap-2"><Checkbox disabled={busy} checked={settings.documents} onCheckedChange={value=>setSettings({...settings,documents:value === true})}/>Avisar de documentos de personal caducados o con vencimiento en los próximos 30 días</label>
            <label className="flex gap-2"><Checkbox disabled={busy} checked={settings.incidents} onCheckedChange={value=>setSettings({...settings,incidents:value === true})}/>Avisar de incidencias que superen los plazos del contrato</label>
            <div className="flex flex-wrap gap-2"><Button disabled={busy}>Guardar configuración</Button><Button disabled={busy} variant="outline" type="button" onClick={()=>void save(true)}>Guardar y comprobar ahora</Button></div>
            {settings.last_run&&<p className="text-sm">Última comprobación {new Date(settings.last_run).toLocaleString()} · {settings.last_result}</p>}
        </form>}
        {error&&<p role="alert" className="text-orange-700">{error}</p>}
    </div>;
}
