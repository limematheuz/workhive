"use client";
import Link from "next/link";
import {WorkHiveLogo} from "@/components/brand/WorkHiveLogo";
import {useEffect,useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import {Loader2,LogOut,ArrowLeft} from "lucide-react";
import {Button} from "@/components/ui/button";
import {UserProvider,useUser} from "@/lib/user-context";
import {authService} from "@/services/auth.service";
import {clearSessionCache} from "@/lib/auth";
import {applicationHome,applicationRoleAllowed,type ApplicationKind} from "@/lib/auth-routes";
const titles={worker:"Mi WorkHive",client:"Portal del cliente",adviser:"Portal de gestoría"};
export function ApplicationSession({kind,children}:{kind:ApplicationKind;children:ReactNode}){
 return <UserProvider><ApplicationGuard kind={kind}>{children}</ApplicationGuard></UserProvider>;
}
function ApplicationGuard({kind,children}:{kind:ApplicationKind;children:ReactNode}){
 const {user,loading}=useUser();const router=useRouter(),pathname=usePathname();const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!loading&&!user)router.replace("/login?next="+encodeURIComponent(pathname));},[loading,user,pathname,router]);
 async function logout(){setBusy(true);setError("");try{await authService.logout();clearSessionCache();router.replace("/accesos");}catch{setError("No se pudo cerrar la sesión. Comprueba la conexión y vuelve a intentarlo.");setBusy(false);}}
 if(loading||!user)return <main className="flex min-h-dvh items-center justify-center gap-3 p-6"><Loader2 aria-hidden="true" className="size-5 animate-spin"/><p role="status">Cargando tu acceso…</p></main>;
 const allowed=applicationRoleAllowed(kind,user.role?.name,user.company_id);
 return <div className="min-h-dvh bg-background text-foreground"><header className="border-b bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"><Link href="/accesos" className="min-w-0"><WorkHiveLogo className="mb-1 w-28"/><span className="text-xs text-muted-foreground">{titles[kind]}</span></Link><div className="flex min-w-0 items-center gap-2"><span className="max-w-40 truncate text-xs text-muted-foreground">{user.full_name||user.email}</span><Button variant="ghost" size="icon" disabled={busy} aria-label="Cerrar sesión" onClick={()=>void logout()}><LogOut className="size-4"/></Button></div></div></header>{error&&<p role="alert" className="mx-auto max-w-7xl p-4 text-sm text-orange-700 dark:text-orange-300">{error}</p>}{allowed?children:<main className="mx-auto max-w-lg space-y-4 px-4 py-12"><h1 className="text-xl font-semibold">Este acceso requiere una cuenta autorizada</h1><p className="text-sm text-muted-foreground">Has entrado con una cuenta de otro tipo. Utiliza el acceso de tu cuenta o cierra la sesión para entrar con la cuenta correspondiente.</p><div className="flex flex-wrap gap-2"><Button asChild><Link href={applicationHome(user)}><ArrowLeft className="size-4"/>Ir a mi cuenta</Link></Button><Button variant="outline" disabled={busy} onClick={()=>void logout()}>Cerrar sesión</Button></div></main>}</div>;
}
