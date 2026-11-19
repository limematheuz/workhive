"use client";
import { useEffect,useState,type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubstituteFinder } from "@/components/staff/SubstituteFinder";
import { PageHeader } from "@/components/ui/page-header";
import { useUser } from "@/lib/user-context";
import { canManageLaborCosts,canViewLaborCosts } from "@/domain/access/roles";
import { StaffService,type Employee } from "@/services/staff.service";
import { readAbsences,saveAbsence,type Absence,type AbsenceDraft } from "@/services/staff-absence.service";

const blank:AbsenceDraft={employee_id:0,substitute_id:null,kind:"Vacaciones",starts_on:"",ends_on:""};
export default function AbsencesPage(){
    const {user,loading}=useUser();
    const canRead=canViewLaborCosts(user), canEdit=canManageLaborCosts(user);
    const [rows,setRows]=useState<Absence[]>([]),[staff,setStaff]=useState<Employee[]>([]);
    const [draft,setDraft]=useState(blank),[editing,setEditing]=useState<number|null>(null);
    const [error,setError]=useState(""),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
    const [finding,setFinding]=useState<Absence|null>(null);
    useEffect(()=>{
        let active=true;
        if(canRead)Promise.all([readAbsences(),StaffService.list()]).then(([records,people])=>{
            if(active){setRows(records);setStaff(people);setReady(true);}
        }).catch(()=>{if(active)setError("No se pudo cargar la plantilla.");});
        return ()=>{active=false;};
    },[canRead,user?.company_id]);
    const available=staff.filter(person=>person.id!==draft.employee_id && !rows.some(r=>r.id!==editing && [r.employee_id,r.substitute_id].includes(person.id) && r.starts_on<=draft.ends_on && r.ends_on>=draft.starts_on));
    async function submit(event:FormEvent){
        event.preventDefault();setBusy(true);setError("");
        try{
            const saved=await saveAbsence(draft,editing);
            setRows(current=>[saved,...current.filter(r=>r.id!==saved.id)]);
            setEditing(null);setDraft(blank);
        }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}
    }
    if(loading)return <p>Cargando…</p>;
    if(!canRead)return <p>Acceso restringido.</p>;
    const personName=(id:number)=>staff.find(p=>p.id===id)?.name??"Trabajador #"+id;
    return <div className="dashboard-page-content space-y-4"><PageHeader icon={CalendarDays} title="Ausencias y sustituciones" subtitle="Cobertura de jornadas completas de la plantilla."/>
        {error&&<p role="alert" className="text-orange-700">{error}</p>}
        {ready&&canEdit&&<form className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-3" onSubmit={submit}>
        <label>Trabajador<Select disabled={busy} required value={draft.employee_id?String(draft.employee_id):""} onValueChange={id=>setDraft({...draft,employee_id:Number(id),substitute_id:null})}><SelectTrigger aria-label="Trabajador ausente"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{staff.map(person=><SelectItem value={String(person.id)} key={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></label>
        <label>Motivo<Select disabled={busy} value={draft.kind} onValueChange={kind=>setDraft({...draft,kind})}><SelectTrigger aria-label="Motivo de ausencia"><SelectValue /></SelectTrigger><SelectContent>{["Vacaciones","Permiso","Ausencia"].map(kind=><SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent></Select></label>
        <label>Desde<DatePicker required value={draft.starts_on} onValueChange={value=>setDraft(previous=>({...previous,starts_on:value,substitute_id:null}))}/></label>
        <label>Hasta<DatePicker required min={draft.starts_on} value={draft.ends_on} onValueChange={value=>setDraft(previous=>({...previous,ends_on:value,substitute_id:null}))}/></label>
        <label>Sustituto<Select disabled={busy} value={draft.substitute_id?String(draft.substitute_id):"none"} onValueChange={id=>setDraft({...draft,substitute_id:id==="none"?null:Number(id)})}><SelectTrigger aria-label="Sustituto de la ausencia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Pendiente de cubrir</SelectItem>{available.map(person=><SelectItem key={person.id} value={String(person.id)} disabled={person.profile.state!=="Activo"}>{person.name} · {person.position} · {person.profile.state}</SelectItem>)}</SelectContent></Select><small className="text-muted-foreground">Registra la ausencia y usa la bolsa para comprobar horario, centro y formación.</small></label>
        <div className="flex items-end gap-2"><Button disabled={busy}>{editing?"Guardar cambios":"Registrar ausencia"}</Button>{editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);setDraft(blank);}}>Cancelar</Button>}</div></form>}
        {ready&&rows.length===0&&<p>No hay ausencias registradas.</p>}
        {rows.map(r=><article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><strong>{personName(r.employee_id)}</strong><p>{r.kind} · {r.starts_on} — {r.ends_on}</p></div><span className={r.substitute_id?"":"text-orange-700"}>{r.substitute_id?"Cubre: "+personName(r.substitute_id):"Pendiente de cubrir"}</span>{canEdit&&<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setFinding(r)}>Buscar en bolsa</Button><Button variant="outline" size="sm" onClick={()=>{setDraft(r);setEditing(r.id);}}>Editar cobertura</Button></div>}</article>)}
        {finding&&<SubstituteFinder absence={finding} close={()=>setFinding(null)} saved={()=>{void readAbsences().then(setRows).catch(()=>setError("No se pudo actualizar la cobertura."));}}/>}</div>;
}
