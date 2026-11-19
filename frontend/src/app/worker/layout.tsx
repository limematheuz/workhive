import type {Metadata,Viewport} from "next";
import {ApplicationSession} from "@/components/applications/ApplicationSession";
import {WorkerWorkspace} from "@/components/worker/WorkerWorkspace";
export const metadata:Metadata={title:"Mi WorkHive · Trabajador",manifest:"/worker/manifest.webmanifest",appleWebApp:{capable:true,title:"Mi WorkHive",statusBarStyle:"default"}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#6545e5"};
export default function WorkerLayout({children}:{children:React.ReactNode}){return <ApplicationSession kind="worker"><WorkerWorkspace>{children}</WorkerWorkspace></ApplicationSession>;}
