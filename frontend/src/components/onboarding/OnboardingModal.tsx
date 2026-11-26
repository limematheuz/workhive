"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Check, Hotel, Loader2, Plus, Sparkles, Users } from "lucide-react";
import { LocationWorkspaceForm, type LocationWorkspacePayload } from "@/components/locations/LocationWorkspaceForm";
import { ServicePlanner } from "@/components/operations/ServicePlanner";
import { StaffForm } from "@/components/staff/StaffForm";
import { DataImportWorkspace } from "./DataImportWorkspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildCompanyOnboardingInput, type OperatingModel, type OnboardingLocationType } from "@/domain/onboarding/cleaning-onboarding";
import { useDictionary } from "@/lib/dictionary-context";
import { CompanyService, type CompanyOnboardingResult } from "@/services/company.service";
import { ClientService } from "@/services/client.service";
import { LocationService } from "@/services/location.service";
import { StaffService, blankEmployee, type Employee } from "@/services/staff.service";
import type { PlannedService } from "@/services/service-planning.service";
import type { User } from "@/types/user";

const STEPS = [
    { id: "model", label: "Empresa" }, { id: "clients", label: "Clientes" },
    { id: "location", label: "Centro y espacios" }, { id: "staff", label: "Trabajadores" },
    { id: "planning", label: "Primer trabajo" }, { id: "ready", label: "Listo" },
] as const;
type Step = typeof STEPS[number]["id"];
async function setupResources() {
    const [clients, locations, staff] = await Promise.allSettled([ClientService.getClients(), LocationService.getLocations(), StaffService.list()]);
    return {
        clients: clients.status === "fulfilled" ? clients.value : null,
        locations: locations.status === "fulfilled" ? locations.value : null,
        staff: staff.status === "fulfilled" ? staff.value : null,
        errors: [clients, locations, staff].flatMap(result => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "No se pudo cargar un apartado."] : []),
    };
}
export function OnboardingModal({ user, onComplete }: { user: User; onComplete: () => void }) {
    const { dict } = useDictionary();
    const router = useRouter();
    const [step, setStep] = useState<Step>("model");
    const [reached, setReached] = useState(0);
    const [model, setModel] = useState<OperatingModel>("service_provider");
    const [resources, setResources] = useState<Awaited<ReturnType<typeof setupResources>> | null>(null);
    const [result, setResult] = useState<CompanyOnboardingResult | null>(null);
    const [existingLocation, setExistingLocation] = useState("");
    const [manualWorker, setManualWorker] = useState<Employee | null>(null);
    const [plan, setPlan] = useState<PlannedService | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const selectedManually = useRef(false);
    const stepIndex = STEPS.findIndex(item => item.id === step);
    const managedLocations = useMemo(() => resources?.locations?.filter(site => site.can_manage_tasks) ?? [], [resources?.locations]);
    useEffect(() => {
        let active = true;
        void setupResources().then(value => { if (active) setResources(value); });
        if (user.company_id) void CompanyService.getCompany(user.company_id).then(company => {
            if (active && !selectedManually.current && (company.operating_model === "service_provider" || company.operating_model === "property_manager" || company.operating_model === "hybrid")) setModel(company.operating_model);
        }).catch(() => { if (active) setError("No se pudieron cargar las preferencias de la empresa."); });
        return () => { active = false; };
    }, [user.company_id]);
    const refresh = () => { void setupResources().then(setResources); };
    function go(next: Step) { setStep(next); setReached(current => Math.max(current, STEPS.findIndex(item => item.id === next))); setError(""); }
    async function finish(destination?: string) {
        if (!user.company_id || busy) return;
        setBusy(true); setError("");
        try {
            await CompanyService.completeOnboarding(user.company_id, buildCompanyOnboardingInput(model));
            localStorage.setItem("workhive_onboarding_done_" + user.id, "true");
            localStorage.removeItem("workhive_onboarding_forced_" + user.id);
            window.dispatchEvent(new Event("workhive_onboarding_completed"));
            onComplete();
            if (destination) router.push(destination);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo terminar la configuración."); }
        finally { setBusy(false); }
    }
    async function createStarterSetup(payload: LocationWorkspacePayload) {
        if (!user.company_id) return;
        setBusy(true); setError("");
        try {
            let setup: CompanyOnboardingResult;
            if (resources?.locations?.length) {
                const location = await LocationService.createLocation(payload);
                setup = { onboarding_completed: true, operating_model: model, created: true, location_id: location.id, location_name: location.name, template_task_id: null, template_name: null };
            } else {
                const { name, address, city, postal_code, location_type, profile, access, spaces, contacts, risks, service_windows, client_id, department_id, team_id } = payload;
                setup = await CompanyService.completeOnboarding(user.company_id, { operating_model: model, location: {
                    name, address, city, postal_code: postal_code || "", client_id, department_id, team_id,
                    location_type: (location_type || "other") as OnboardingLocationType,
                    profile, access, spaces, contacts, risks, service_windows,
                } });
            }
            setResult(setup); setResources(await setupResources()); go("staff");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar el centro."); }
        finally { setBusy(false); }
    }
    function useExisting() {
        const location = resources?.locations?.find(site => String(site.id) === existingLocation);
        if (!location) return;
        setResult({ onboarding_completed: true, operating_model: model, created: false, location_id: location.id, location_name: location.name, template_task_id: null, template_name: null });
        go("staff");
    }
    return <Dialog open onOpenChange={open => { if (!open) void finish(); }}><DialogContent confirmDiscard={step !== "ready"} showCloseButton={!busy} className="dialog-glass flex max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <aside className="dialog-glass-chrome hidden w-52 shrink-0 space-y-4 border-r p-5 md:block"><p className="text-sm font-semibold">Configura WorkHive</p><ol className="space-y-1">{STEPS.map((item, index) => <li key={item.id}><Button type="button" variant={item.id === step ? "secondary" : "ghost"} disabled={busy || index > reached} onClick={() => go(item.id)} className="w-full justify-start text-xs" aria-current={item.id === step ? "step" : undefined}><span className="flex size-5 items-center justify-center rounded-full border text-[10px]">{index < stepIndex ? <Check className="size-3" /> : index + 1}</span>{item.label}</Button></li>)}</ol><p className="text-xs text-muted-foreground">Los registros se guardan en las mismas pantallas del programa.</p></aside>
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="dialog-glass-chrome border-b px-5 py-4 pr-12"><p className="text-xs text-muted-foreground">Paso {stepIndex + 1} de {STEPS.length}</p><DialogTitle className="mt-1 text-lg font-semibold">{STEPS[stepIndex].label}</DialogTitle><DialogDescription className="mt-1 text-xs">Clientes, centros, plantilla y primer servicio conectados con los datos reales de tu empresa.</DialogDescription></header>
            <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
                {error && <p role="alert" className="rounded-lg bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}</p>}
                {resources?.errors.length ? <div className="space-y-1 rounded-lg border border-orange-300/40 p-3 text-xs text-orange-700 dark:text-orange-300">{resources.errors.map(message => <p key={message}>{message}</p>)}<Button type="button" size="sm" variant="outline" onClick={refresh}>Volver a cargar datos</Button></div> : null}
                {step === "model" && <div className="grid gap-3 lg:grid-cols-3">{[
                    { id: "service_provider" as const, label: dict.onboarding.model_provider, description: dict.onboarding.model_provider_desc, icon: BriefcaseBusiness },
                    { id: "property_manager" as const, label: dict.onboarding.model_manager, description: dict.onboarding.model_manager_desc, icon: Hotel },
                    { id: "hybrid" as const, label: dict.onboarding.model_hybrid, description: dict.onboarding.model_hybrid_desc, icon: Building2 },
                ].map(item => <Button variant="custom" type="button" key={item.id} disabled={busy} onClick={() => { selectedManually.current = true; setModel(item.id); }} aria-pressed={model === item.id} className={"glass-panel space-y-3 rounded-xl border p-4 text-left " + (model === item.id ? "border-accent bg-accent/5" : "border-[var(--border-soft)]")}><item.icon className="size-5 text-accent" /><strong className="block text-sm">{item.label}</strong><span className="block text-xs text-muted-foreground">{item.description}</span></Button>)}</div>}
                {step === "clients" && <><p className="text-sm">Importa tu lista de clientes; podrás seleccionarlos al configurar el centro en el siguiente paso.</p><DataImportWorkspace fixedKind="clients" showLinks={false} onImported={refresh} /><p className="text-xs text-muted-foreground">{resources?.clients ? resources.clients.length + " clientes registrados." : "Cargando clientes…"}</p></>}
                <div hidden={step !== "location"} className="space-y-4">
                    {!!managedLocations.length && <div className="flex flex-wrap gap-2 rounded-xl border p-3"><div className="min-w-0 flex-1"><Select value={existingLocation} onValueChange={setExistingLocation}><SelectTrigger aria-label="Centro existente para el arranque"><SelectValue placeholder="Usar un centro ya creado" /></SelectTrigger><SelectContent>{managedLocations.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select></div><Button type="button" variant="outline" disabled={!existingLocation || busy} onClick={useExisting}>Continuar con este centro</Button></div>}
                    <div className="h-[min(64vh,650px)]"><LocationWorkspaceForm clients={resources?.clients ?? []} requirePostalCode submitting={busy} submitLabel="Guardar centro y continuar" onSubmit={createStarterSetup} onCancel={() => go("clients")} /></div>
                </div>
                {step === "staff" && <><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Incorpora la plantilla que realizará los servicios.</p><Button type="button" variant="outline" onClick={() => setManualWorker(blankEmployee())}><Plus className="size-4" />Añadir trabajador</Button></div><DataImportWorkspace fixedKind="staff" showLinks={false} onImported={refresh} /><p className="text-xs text-muted-foreground">{resources?.staff ? resources.staff.length + " trabajadores registrados." : "Cargando plantilla…"}</p></>}
                {step === "planning" && <><p className="rounded-lg bg-muted/40 p-3 text-sm">Planifica una limpieza real: elige los espacios y tareas del centro, su horario y las personas o el equipo.</p>{resources?.locations?.length ? <ServicePlanner key={result?.location_id ?? "initial"} locations={resources.locations} initialLocationId={result?.location_id ?? undefined} navigateOnCreate={false} saved={(_, service) => { if (service) { setPlan(service); go("ready"); } }} /> : <p className="text-sm text-orange-700">Configura primero un centro con espacios y tareas.</p>}</>}
                {step === "ready" && <div className="space-y-4 rounded-xl border p-5"><Sparkles className="size-7 text-accent" /><h3 className="font-semibold">{plan ? "Primer trabajo creado" : "Base de la empresa preparada"}</h3>{result && <p className="text-sm"><strong>Centro:</strong> {result.location_name}</p>}<p className="flex items-center gap-2 text-sm"><Users className="size-4" />{resources?.staff ? resources.staff.length + " trabajadores" : "Plantilla pendiente de cargar"} · {resources?.clients ? resources.clients.length + " clientes" : "Clientes pendientes de cargar"}</p>{plan ? <p className="text-sm"><strong>{plan.work_order.title}</strong> · {plan.space_count} espacios programados.</p> : <p className="text-sm text-orange-700">El primer trabajo queda pendiente. Puedes volver al paso anterior para crearlo.</p>}</div>}
            </div>
            <footer className="dialog-glass-chrome flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3"><Button type="button" variant="ghost" disabled={busy} onClick={() => stepIndex ? go(STEPS[stepIndex - 1].id) : void finish()}>{stepIndex ? <ArrowLeft className="size-4" /> : null}{stepIndex ? "Anterior" : "Configurar más tarde"}</Button>
                {step === "model" && <Button type="button" disabled={busy} onClick={() => go("clients")}>Continuar<ArrowRight className="size-4" /></Button>}
                {step === "clients" && <Button type="button" disabled={busy} onClick={() => go("location")}>Continuar con el centro<ArrowRight className="size-4" /></Button>}
                {step === "staff" && <Button type="button" disabled={busy || !resources?.locations?.length} onClick={() => go("planning")}>Planificar el primer trabajo<ArrowRight className="size-4" /></Button>}
                {step === "planning" && <Button type="button" variant="outline" onClick={() => go("ready")}>Dejar el primer trabajo pendiente</Button>}
                {step === "ready" && <Button type="button" disabled={busy} onClick={() => void finish(plan?.task_id ? "/dashboard?taskId=" + plan.task_id : "/dashboard")}>{busy && <Loader2 className="size-4 animate-spin" />}{plan?.task_id ? "Terminar y abrir trabajo" : "Terminar configuración"}</Button>}
            </footer>
        </div>
        {manualWorker && <StaffForm worker={manualWorker} close={() => setManualWorker(null)} saved={() => { setManualWorker(null); refresh(); }} />}
    </DialogContent></Dialog>;
}
