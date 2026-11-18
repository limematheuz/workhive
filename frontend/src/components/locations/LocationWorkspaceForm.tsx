"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PremiumTabsNavigation } from "@/components/ui/premium-tabs";
import { LocationContactsSection } from "./LocationContactsSection";
import { LocationFeaturesStep } from "./LocationFeaturesStep";
import { LocationInfoAccessStep } from "./LocationInfoAccessStep";
import { LocationTasksStep, LocationTaskCatalog } from "./LocationTasksStep";
import { LocationTypeStep } from "./LocationTypeStep";
import { selectedLocationFeatureLabels } from "@/domain/locations/location-task-catalog";
import { LocationWizardSummary } from "./LocationWizardSummary";
import { useLocationWorkspace, WORKSPACE_STEPS, type LocationWorkspaceFormProps, type LocationWorkspaceStep } from "./useLocationWorkspace";
export type { LocationWorkspacePayload } from "./location-workspace-types";

export function LocationWorkspaceForm(props:LocationWorkspaceFormProps) {
    const state=useLocationWorkspace(props);
    const [selectedIndex,setSelectedIndex]=useState(0);
    const scrollRef=useRef<HTMLDivElement>(null);
    const {location,submitting,submitLabel,clients,portalMode,requirePostalCode}=props;
    const {activeStep,profile,catalog,spaces}=state;
    useEffect(()=>{scrollRef.current?.scrollTo({top:0});},[activeStep]);
    const featureLabels = selectedLocationFeatureLabels(catalog, profile.attributes);
    const summary={ featureLabels,name:state.name,address:state.address,city:state.city,clientName:clients.find(client=>String(client.id)===state.clientId)?.name,profile,access:state.access,spaces,contacts:state.contacts,typeLabel:catalog?.site_types.find(site=>site.id===profile.site_type)?.label,existing:Boolean(location),hasAccessCode:Boolean(location?.access?.has_access_code),onEdit:state.goToStep };
    return <form onSubmit={state.handleSubmit} className="wh-location-wizard flex h-full min-h-0 flex-col">
        <Tabs value={activeStep} onValueChange={value=>state.goToStep(value as LocationWorkspaceStep)} className="flex min-h-0 flex-1 flex-col">
            <div className="wh-steps shrink-0"><PremiumTabsNavigation tabs={WORKSPACE_STEPS.map((step,index)=>({id:step.id,icon:step.icon,label:`${index+1}. ${step.label}`,compactLabel:`${index+1}. ${step.label}`}))} activeTab={activeStep} onChange={state.goToStep} mobileLabel="Pasos de la ubicación" className="mb-0"/></div>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6"><div className={activeStep==="review"?"min-w-0":"wh-wizard-content"}>
                <div className="wh-wizard-main">
                    <TabsContent value="information" aria-labelledby={undefined} aria-label="Información" className="m-0 space-y-4">
                        <LocationInfoAccessStep clients={clients} showClientAssignment={!portalMode} requirePostalCode={requirePostalCode} name={state.name} address={state.address} city={state.city} postalCode={state.postalCode} clientId={state.clientId} departments={state.departments} teams={state.teams} organizationAssignmentAvailable={state.organizationAssignmentAvailable} departmentId={state.departmentId} teamId={state.teamId} access={state.access} hasStoredAccessCode={Boolean(location?.access?.has_access_code)} setName={state.setName} setAddress={state.setAddress} setCity={state.setCity} setPostalCode={state.setPostalCode} setClientId={state.setClientId} setDepartmentId={state.setDepartmentId} setTeamId={state.setTeamId} setAccess={state.setAccess}/>
                        <section className="wh-panel"><h4 className="wh-panel-title mb-4">Datos de referencia</h4><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="location-workspace-code">Código interno</Label><Input id="location-workspace-code" value={profile.internal_code||""} onChange={event=>state.setProfile({...profile,internal_code:event.target.value})} placeholder="OFI-BCN-001"/></div><div className="space-y-1.5"><Label htmlFor="location-workspace-reference">Referencia en el sitio</Label><Input id="location-workspace-reference" value={profile.site_reference||""} onChange={event=>state.setProfile({...profile,site_reference:event.target.value})} placeholder="Planta, puerta o referencia"/></div><div className="space-y-1.5"><Label htmlFor="location-workspace-zone">Zona / distrito</Label><Input id="location-workspace-zone" value={String(profile.attributes.zone||"")} onChange={event=>state.setAttribute("zone",event.target.value)} placeholder="Ej.: Eixample"/></div></div></section>
                        <LocationContactsSection contacts={state.contacts} setContacts={state.setContacts}/>
                    </TabsContent>
                    <TabsContent value="type" aria-labelledby={undefined} aria-label="Tipo de ubicación" className="m-0 space-y-4"><LocationTypeStep catalog={catalog} loading={state.catalogLoading} profile={profile} setProfile={state.setProfile}/></TabsContent>
                    <TabsContent value="operations" aria-labelledby={undefined} aria-label="Características" className="m-0"><LocationFeaturesStep catalog={catalog} profile={profile} setProfile={state.setProfile} setAttribute={state.setAttribute} contacts={state.contacts} setContacts={state.setContacts} risks={state.risks} setRisks={state.setRisks} serviceWindows={state.serviceWindows} setServiceWindows={state.setServiceWindows}/></TabsContent>
                    <TabsContent value="spaces" aria-labelledby={undefined} aria-label="Espacios y tareas" className="m-0"><LocationTasksStep spaces={spaces} setSpaces={state.setSpaces} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} editingExistingLocation={Boolean(location)} catalog={catalog} suggesting={state.suggesting} onSuggest={()=>void state.suggestSpaces()}/></TabsContent>
                    <TabsContent value="review" aria-labelledby={undefined} aria-label="Resumen" className="m-0 space-y-4"><div><h3 className="text-xl font-semibold">Todo listo para {location?"guardar":"crear"} la ubicación</h3><p className="wh-panel-subtitle">Revisa los datos. Puedes editar cualquier sección antes de confirmar.</p></div><LocationWizardSummary {...summary}/></TabsContent>
                </div>
                {activeStep!=="review"&&<aside className="wh-wizard-aside" aria-label="Resumen de la ubicación">{activeStep==="spaces"&&!location?<LocationTaskCatalog catalog={catalog} spaces={spaces} selectedIndex={selectedIndex} setSpaces={state.setSpaces}/>:<LocationWizardSummary {...summary} compact/>}</aside>}
            </div></div>
        </Tabs>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-soft)] bg-[var(--bg-primary)] px-4 py-3 sm:px-6">
            <div>{state.activeStepIndex>0&&<Button type="button" variant="outline" onClick={state.goPrevious}><ChevronLeft className="h-4 w-4"/>Anterior</Button>}</div>
            <div className="flex gap-2"><Button type="button" variant="cancel" onClick={state.dismiss}>Cancelar</Button>{activeStep!=="review"?<Button key="next" type="button" onClick={state.goNext}>Siguiente<ChevronRight className="h-4 w-4"/></Button>:<Button key="save" type="submit" disabled={submitting}>{submitting?"Guardando…":submitLabel}</Button>}</div>
        </div>
    </form>;
}
