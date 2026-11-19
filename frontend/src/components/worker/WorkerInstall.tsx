"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from "react";
import {Download,Smartphone} from "lucide-react";
import {Button} from "@/components/ui/button";
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const subscribe=(changed:()=>void)=>{const media=window.matchMedia("(display-mode: standalone)");media.addEventListener("change",changed);window.addEventListener("appinstalled",changed);return()=>{media.removeEventListener("change",changed);window.removeEventListener("appinstalled",changed);};};
export function WorkerInstall(){
 const standalone=useSyncExternalStore(subscribe,()=>window.matchMedia("(display-mode: standalone)").matches,()=>false);
 const prompt=useRef<InstallPrompt|null>(null);
 const [help,setHelp]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  const install=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;};window.addEventListener("beforeinstallprompt",install);
  if("serviceWorker" in navigator&&navigator.onLine)void navigator.serviceWorker.register("/worker-sw.js",{scope:"/worker"}).catch(()=>setError("No se pudo preparar la instalación. Puedes seguir usando la app desde el navegador."));
  return()=>window.removeEventListener("beforeinstallprompt",install);
 },[]);
 async function install(){const invitation=prompt.current;if(!invitation){setHelp(value=>!value);return;}try{await invitation.prompt();await invitation.userChoice;prompt.current=null;}catch{setError("No se pudo completar la instalación. Prueba desde el menú de tu navegador.");}}
 if(standalone)return null;
 return <section className="space-y-2 rounded-xl border bg-card p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm"><Smartphone aria-hidden="true" className="size-4 text-accent"/>Lleva Mi WorkHive en tu pantalla de inicio</p><Button type="button" variant="outline" size="sm" onClick={()=>void install()}><Download className="size-3.5"/>Instalar app</Button></div>{help&&<p className="text-xs text-muted-foreground">En Android o escritorio, abre el menú del navegador y elige Instalar aplicación. En iPhone o iPad, abre Compartir → Añadir a pantalla de inicio. Para trabajar sin conexión, prepara tu jornada antes de salir.</p>}{error&&<p role="status" className="text-xs text-orange-700">{error}</p>}</section>;
}
