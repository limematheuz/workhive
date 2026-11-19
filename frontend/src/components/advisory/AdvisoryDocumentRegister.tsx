"use client";

import { useState } from "react";
import { DocumentRegisterWorkspace } from "@/components/documents/DocumentRegisterWorkspace";

export function AdvisoryDocumentRegister({ company }: { company: number }) {
    const [open, setOpen] = useState(false);
    return <details className="rounded-2xl border bg-card p-4" onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Centro documental laboral · revisiones y firmas</summary><div className="mt-4">{open && <DocumentRegisterWorkspace ownerType="staff" companyId={company} embedded />}</div></details>;
}
