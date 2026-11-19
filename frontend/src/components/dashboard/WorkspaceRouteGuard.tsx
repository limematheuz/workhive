"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Loader2,LockKeyhole,RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {WORKSPACE_NAVIGATION} from "@/domain/navigation/workspace-navigation";
import {useWorkspaceNavigation} from "./WorkspaceNavigationProvider";
const known=WORKSPACE_NAVIGATION.flatMap(group=>group.hrefs.filter(href=>href!=="/dashboard"));
export function WorkspaceRouteGuard({children}:{children:React.ReactNode}){
 const path=usePathname();const access=useWorkspaceNavigation();
 if(path==="/dashboard/profile"||path.startsWith("/dashboard/profile/"))return children;
 if(access.loading)return <div role="status" className="flex min-h-64 items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin"/>Comprobando tu espacio de trabajo…</div>;
 const base=known.filter(href=>path===href||path.startsWith(href+"/")).sort((a,b)=>b.length-a.length)[0];const capabilityAllowed=access.canAccessPath(path);const allowed=capabilityAllowed&&(!base||access.navigation.visibleNavLinks.some(link=>link.href===base));
 if(!access.error&&allowed)return children;
 const inactive=capabilityAllowed&&base&&access.navigation.navLinks.some(link=>link.href===base);
 return <section className="mx-auto flex max-w-xl flex-col items-start gap-4 px-5 py-12"><LockKeyhole aria-hidden="true" className="size-7 text-muted-foreground"/><h1 className="text-xl font-semibold">{access.error?"No se ha podido comprobar tu acceso":inactive?"Este módulo no está disponible":"No tienes acceso a este apartado"}</h1><p className="text-sm leading-6 text-muted-foreground">{access.error?"Comprueba la conexión y vuelve a intentarlo. Tus permisos y datos se verificarán antes de mostrar la pantalla.":inactive?"El módulo no está activo en esta empresa. Un administrador puede revisar su configuración y suscripción.":"Tu cuenta no tiene autorización para consultar esta información en la empresa activa. Puedes continuar en los apartados disponibles de tu menú."}</p><div className="flex flex-wrap gap-2">{access.error&&<Button onClick={access.reload}><RefreshCw className="size-4"/>Volver a comprobar</Button>}<Button variant="outline" asChild><Link href="/dashboard">Ir al inicio</Link></Button></div></section>;
}
