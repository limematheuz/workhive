import {useMemo} from "react";
import {reportValue} from "@/lib/report-value";
import { Button } from "@/components/ui/button";
import type { ReportResult } from "@/services/custom-report.service";
export function ReportResults({ data, offset, busy, page }: {
    data: ReportResult;
    offset: number;
    busy: boolean;
    page: (offset: number) => void;
}) {
    const dates=useMemo(()=>new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short",timeZone:data.timezone}),[data.timezone]);
    return <section className="space-y-3 rounded-xl border p-4"><p className="text-sm">{data.rows.length} registros · desde {offset + 1} · Fechas en {data.timezone}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{data.columns.map(c => <th key={c.key} className="px-2 py-2">{c.label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr className="border-b" key={String(row.__row_id)}>{data.columns.map(c => <td key={c.key} className="max-w-xs break-words px-2 py-2">{reportValue(c.key,row[c.key],dates)}</td>)}</tr>)}</tbody></table></div>
 {!data.rows.length && <p className="text-sm text-muted-foreground">No hay registros para este periodo y ámbito.</p>}<div className="flex gap-2"><Button variant="outline" disabled={busy || !offset} onClick={() => page(Math.max(0, offset - 500))}>Anterior</Button><Button variant="outline" disabled={busy || !data.has_more} onClick={() => page(offset + 500)}>Siguientes 500</Button></div></section>;
}
