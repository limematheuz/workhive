"use client";
import {Checkbox} from "@/components/ui/checkbox";
import {FormSelect} from "@/components/ui/form-select";
import {useEffect,useMemo,useState} from "react";
import {Network} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {DatePicker} from "@/components/ui/date-picker";
import {SummaryMetricCard,SummaryMetricGrid} from "@/components/ui/summary-metric-card";
import {RegionalSettings} from "@/components/organization/RegionalSettings";
import {readConsolidation,saveConsolidation,type Consolidation} from "@/services/consolidation.service";

export default function ConsolidationPage() {
    const [companies,setCompanies]=useState<{id:number;name:string}[]>([]);
    const [selected,setSelected]=useState<number[]>([]);
    const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
    const [period,setPeriod]=useState("month");
    const [currency,setCurrency]=useState("EUR");
    const [rate,setRate]=useState("1");
    const [data,setData]=useState<Consolidation|null>(null);
    const [error,setError]=useState("");
    const [busy,setBusy]=useState(false);
    useEffect(()=>{void readConsolidation<{id:number;name:string}[]>("companies").then(setCompanies).catch(e=>setError(e.message));},[]);
    async function calculate() {
        setBusy(true);setError("");setData(null);
        try{setData(await saveConsolidation<Consolidation>("report",{companies:selected,reference_date:date,period,currency,eur_rate:rate}));}
        catch(e){setError(e instanceof Error?e.message:"No se pudo obtener el informe.");}
        finally{setBusy(false);}
    }
    const selectedIds=useMemo(()=>new Set(selected),[selected]);
    const money=(amount:string)=>Number(amount).toLocaleString("es-ES",{style:"currency",currency:data?.currency??currency});
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={Network} title="Sociedades y consolidación" subtitle="Ingresos y costes registrados de las sociedades autorizadas. Importes sin impuestos."/>
        <RegionalSettings/>
        <form className="space-y-3 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void calculate();}}>
            <fieldset className="flex flex-wrap gap-3"><legend>Sociedades del informe</legend>{companies.map(c=><label key={c.id} className="flex gap-2"><Checkbox checked={selectedIds.has(c.id)} onCheckedChange={checked=>setSelected(current=>checked===true?[...current,c.id]:current.filter(id=>id!==c.id))}/>{c.name}</label>)}</fieldset>
            <div className="flex flex-wrap items-end gap-3"><label>Fecha de referencia<DatePicker required value={date} onValueChange={setDate}/></label>
                <label>Periodo<FormSelect aria-label={"Periodo"}  value={period} onValueChange={selectedOptionValue=>setPeriod(selectedOptionValue)}><option value="month">Mes</option><option value="year">Año</option></FormSelect></label>
                <label>Moneda del informe<Input required pattern="[A-Z]{3}" maxLength={3} value={currency} onChange={e=>{setCurrency(e.target.value.toUpperCase());setData(null);}}/></label>
                <label>1 EUR equivale a<Input required type="number" min=".00000001" step=".00000001" value={rate} onChange={e=>setRate(e.target.value)}/></label>
                <Button disabled={busy||!selected.length}>Obtener informe</Button>
            </div>
            <p className="text-sm text-muted-foreground">El tipo de cambio es el que indiques para este informe. Los registros de origen conservan sus importes en EUR.</p>
        </form>
        {error&&<p role="alert" className="text-orange-700">{error}</p>}
        {data&&<><SummaryMetricGrid><SummaryMetricCard icon={Network} label="Ingresos registrados" value={money(data.revenue)}/><SummaryMetricCard icon={Network} label="Costes registrados" value={money(data.cost)}/><SummaryMetricCard icon={Network} label="Margen conocido" value={money(data.margin)}/></SummaryMetricGrid>
            {data.companies.map(c=><article className="flex flex-wrap justify-between gap-3 rounded-lg border p-3" key={c.company_id}><strong>{c.name}</strong><span>Ingresos {money(c.revenue)}</span><span>Costes {money(c.cost)}</span><span>Margen {money(c.margin)}</span></article>)}</>}
    </div>;
}
