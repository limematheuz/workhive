"use client";
import {useEffect,useState} from "react";
import {Library,Plus,RefreshCw} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {useDictionary} from "@/lib/dictionary-context";
import {useUser} from "@/lib/user-context";
import {TemplateTaskService} from "@/services/template.service";
import {useTemplateCrud} from "@/hooks/useTemplateCrud";
import type {TemplateTask} from "@/types/template";
import {TemplateModal} from "@/components/tasks/TemplateModal";
import {ServiceCatalogList} from "@/components/services/ServiceCatalogList";
export default function ServicesPage(){
 const {dict}=useDictionary();const {user}=useUser();const [items,setItems]=useState<TemplateTask[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");const [revision,setRevision]=useState(0);const crud=useTemplateCrud({dict,setTemplates:setItems});
 useEffect(()=>{let active=true;TemplateTaskService.getTemplates().then(rows=>{if(active){setItems(rows);setError("");}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"No se pudieron cargar los servicios.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[user?.company_id,user?.id,revision]);
 return <div className="dashboard-page-content space-y-4"><PageHeader icon={Library} title="Servicios y tarifas" subtitle="Define lo que ofrece tu empresa y reutilízalo en presupuestos y trabajos." actions={<><Button variant="outline" size="icon" aria-label="Actualizar servicios" onClick={()=>setRevision(v=>v+1)}><RefreshCw className="size-4"/></Button><Button onClick={()=>crud.handleOpenTemplateModal(null)}><Plus className="size-4"/>Nuevo servicio</Button></>}/>{error&&<p role="alert" className="rounded-xl border border-orange-300/50 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}</p>}<ServiceCatalogList items={items} loading={loading} edit={crud.handleOpenTemplateModal} archive={crud.handleDeleteTemplate}/><TemplateModal {...crud} dict={dict} isSaving={crud.isSavingTemplate}/></div>;
}
