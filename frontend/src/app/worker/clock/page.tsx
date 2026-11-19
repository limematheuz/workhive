import {WorkerClock} from "@/components/worker/WorkerClock";
import {Suspense} from "react";
export default function WorkerClockPage(){return <Suspense fallback={<p role="status">Cargando tus fichajes…</p>}><WorkerClock/></Suspense>;}
