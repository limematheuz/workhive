import { StaffDirectory } from "@/components/staff/StaffDirectory";
import { Suspense } from "react";
export default function Page() { return <Suspense fallback={<p role="status" className="p-6">Cargando plantilla…</p>}><StaffDirectory teams={false} /></Suspense>; }
