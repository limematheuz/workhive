"use client";
import {Suspense,useCallback,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {Calculator} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {SpaceWorkforceEditor} from "@/components/operations/SpaceWorkforceEditor";
import {EstimateMaterials} from "@/components/operations/EstimateMaterials";
import {EstimateResult} from "@/components/operations/EstimateResult";
import {useResourceEffect} from "@/hooks/useResourceEffect";
import {useUser} from "@/lib/user-context";
import {canManageFinance} from "@/domain/access/roles";
import {estimateOptions,previewEstimate,saveEstimate,type EstimateInput,type EstimateOptions,type EstimatePreview} from "@/services/service-estimator.service";
import type {SpaceAllocation} from "@/services/service-planning.service";
const empty:EstimateOptions={locations:[],opportunity:null,spaces:[],choices:{people:[],crews:[]},materials:[],warehouses:[],inventory_available:false};
export default function CalculatorPage(){return <Suspense fallback={<p>Cargando calculadora…</p>}><CalculatorWorkspace/></Suspense>;}
function CalculatorWorkspace(){
 const {user}=useUser(),params=useSearchParams();
 const seed=params.get("opportunity"),opportunity=seed&&/^\d+$/.test(seed)?Number(seed):undefined;
 return <CalculatorForm key={user?.company_id+":"+user?.id+":"+opportunity} opportunity={opportunity}/>;
}
function CalculatorForm({opportunity}:{opportunity?:number}){
 const {user,loading}=useUser();
 const [location,setLocation]=useState(0),[options,setOptions]=useState<EstimateOptions>(empty),[loaded,setLoaded]=useState(false);
 const [spaces,setSpaces]=useState<SpaceAllocation[]>([]),[materials,setMaterials]=useState<EstimateInput["materials"]>([]);
 const [title,setTitle]=useState(""),[other,setOther]=useState("0"),[margin,setMargin]=useState("25"),[count,setCount]=useState(1),[tax,setTax]=useState("21");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<{data:EstimatePreview;input:EstimateInput}|null>(null),[saved,setSaved]=useState<{id:number;number:string}|null>(null);
 const request=useCallback(()=>estimateOptions(location||undefined,opportunity),[location,opportunity]);
 useResourceEffect(Boolean(user),user?.company_id+":"+user?.id+":"+location+":"+opportunity,request,data=>{setOptions(data);setLoaded(true);setError("");},e=>{setOptions(empty);setLoaded(true);setError(e instanceof Error?e.message:"No se pudieron cargar las fuentes.");});
 const invalidate=()=>{setResult(null);setSaved(null);setError("");};
 const input:EstimateInput={location_id:location,spaces,materials,other_costs:other,target_margin_percent:margin,occurrences:count,tax_rate:(Number(tax)/100).toFixed(4)};
 async function calculate(){setBusy(true);setError("");setSaved(null);try{const data=await previewEstimate(input);setResult({data,input});}catch(e){setResult(null);setError(e instanceof Error?e.message:"No se pudo calcular.");}finally{setBusy(false);}}
 async function save(){if(!result)return;setBusy(true);setError("");try{const quote=await saveEstimate(result.input,title,result.data.fingerprint,opportunity);setSaved({id:quote.quote_id,number:quote.quote_number});setResult(null);}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}}
 if(loading)return <p>Cargando…</p>;
 return <div className="dashboard-page-content space-y-4"><PageHeader icon={Calculator} title="Calculadora de presupuestos" subtitle="Previsión conectada con espacios, tareas, trabajadores e inventario reales."/>
 {error&&<p role="alert" className="rounded-xl border border-orange-300 p-3 text-sm text-orange-700">{error}</p>}
 {options.opportunity&&<p className="rounded-xl bg-accent/5 p-3 text-sm">Oportunidad: <strong>{options.opportunity.title}</strong> · Se muestran las ubicaciones de su cliente. <Link className="underline" href="/dashboard/commercial">Ver seguimiento comercial</Link></p>}
 {saved&&<p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">Presupuesto {saved.number} creado con su previsión de costes. <Link className="font-semibold underline" href={"/dashboard/quotes?quote="+saved.id}>Abrir presupuesto</Link></p>}
 <fieldset disabled={busy} className="space-y-4"><section className="grid gap-3 rounded-2xl border bg-[var(--bg-card)] p-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="calculator-location">Ubicación</Label><Select disabled={busy||!options.locations.length} value={location?String(location):""} onValueChange={next=>{setLocation(Number(next));setSpaces([]);setMaterials([]);setLoaded(false);invalidate();}}><SelectTrigger id="calculator-location"><SelectValue placeholder="Seleccionar ubicación"/></SelectTrigger><SelectContent>{options.locations.map(site=><SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="calculator-title">Título del presupuesto</Label><Input id="calculator-title" maxLength={255} value={title} placeholder="Ej. Limpieza de oficinas · planta 1" onChange={e=>setTitle(e.target.value)}/></div>{loaded&&!options.locations.length&&<p className="text-sm text-orange-700 sm:col-span-2">No hay ubicaciones accesibles para este cálculo. Revisa los clientes y <Link className="underline" href="/dashboard/locations">crea su ubicación</Link>.</p>}</section>
 {location>0&&loaded&&<><SpaceWorkforceEditor spaces={options.spaces} value={spaces} choices={options.choices} onChange={value=>{setSpaces(value);invalidate();}} disabled={busy}/><EstimateMaterials options={options} value={materials} onChange={value=>{setMaterials(value);invalidate();}} disabled={busy}/>
 <section className="grid gap-3 rounded-2xl border bg-[var(--bg-card)] p-4 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm">Otros costes por servicio (€)<Input type="number" min="0" step=".01" value={other} onChange={e=>{setOther(e.target.value);invalidate();}}/></label><label className="text-sm">Margen objetivo (%)<Input type="number" min="0" max="95" step=".01" value={margin} onChange={e=>{setMargin(e.target.value);invalidate();}}/></label><label className="text-sm">Número de servicios<Input type="number" min="1" max="366" step="1" value={count} onChange={e=>{setCount(Number(e.target.value));invalidate();}}/></label><label className="text-sm">IVA a revisar (%)<Input type="number" min="0" max="100" step=".01" value={tax} onChange={e=>{setTax(e.target.value);invalidate();}}/></label></section><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Las duraciones manuales y otros costes se identificarán como previsiones indicadas.</p><Button type="button" disabled={busy||!spaces.length} onClick={()=>void calculate()}>{busy?"Calculando…":"Calcular precio"}</Button></div></>}
 </fieldset>{result&&<EstimateResult data={result.data} busy={busy} canSave={canManageFinance(user)&&Boolean(title.trim())} onSave={()=>void save()}/>}
 </div>;
}
