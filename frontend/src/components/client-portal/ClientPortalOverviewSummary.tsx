"use client";
import { ClipboardCheck, FileText, MessageSquareWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { clientQuoteNeedsDecision, portalComplaintUnresolved, type ClientPortalActionTab, type ClientPortalAttention } from "@/lib/portal-attention";
import type { ClientPortalOverview } from "@/types/client-portal";
export function ClientPortalOverviewSummary({ overview, clientName, onNavigate }: { overview: ClientPortalOverview; clientName: string; onNavigate?: (tab: ClientPortalActionTab, attention: ClientPortalAttention) => void }) {
 const quotes = overview.quotes.filter(quote => clientQuoteNeedsDecision(quote));
 const inspections = overview.inspections.filter(inspection => !inspection.acceptance);
 const complaints = overview.complaints.filter(portalComplaintUnresolved);
 return <section className="space-y-4">
 <SummaryMetricGrid desktopColumns={3} aria-label="Requiere tu atención">
 <FinanceMetricButton label="Presupuestos por aceptar" value={String(quotes.length)} description="Revisar importe y condiciones · tu decisión" icon={FileText} attention={quotes.length > 0} onClick={()=>onNavigate?.("quotes","respond")}/>
 <FinanceMetricButton label="Inspecciones por validar" value={String(inspections.length)} description="Informes compartidos · tu revisión" icon={ClipboardCheck} attention={inspections.length > 0} onClick={()=>onNavigate?.("inspections","validate")}/>
 <Button variant="outline" className="col-span-2 h-auto min-h-0 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left lg:hidden" aria-label={`Reclamaciones en seguimiento: ${complaints.length}. Pendientes de resolución · tu proveedor`} onClick={()=>onNavigate?.("complaints","unresolved")}><MessageSquareWarning className="size-5 shrink-0 text-accent" aria-hidden="true"/><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Reclamaciones en seguimiento</span><span className="mt-1 block text-xs text-muted-foreground">Pendientes de resolución · tu proveedor</span></span><strong className="text-2xl font-semibold tabular-nums text-accent">{complaints.length}</strong></Button>
 <div className="hidden lg:block"><FinanceMetricButton label="Reclamaciones en seguimiento" value={String(complaints.length)} description="Pendientes de resolución · tu proveedor" icon={MessageSquareWarning} onClick={()=>onNavigate?.("complaints","unresolved")}/></div>
 </SummaryMetricGrid>
 <Card><CardContent className="space-y-3"><h2 className="text-base font-semibold">Siguiente paso</h2>
 {quotes.slice(0,2).map(quote=><div key={"quote-"+quote.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="min-w-0"><p className="text-sm font-medium">{quote.title}</p><p className="mt-1 text-xs text-muted-foreground">{quote.quote_number} · Te corresponde revisar y aceptar</p></div><Button variant="outline" size="sm" onClick={()=>onNavigate?.("quotes","respond")}>Revisar presupuesto</Button></div>)}
 {inspections.slice(0,2).map(inspection=><div key={"inspection-"+inspection.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div><p className="text-sm font-medium">{inspection.template_title}</p><p className="mt-1 text-xs text-muted-foreground">{inspection.location_name} · Te corresponde revisar la inspección</p></div><Button variant="outline" size="sm" onClick={()=>onNavigate?.("inspections","validate")}>Ver inspección</Button></div>)}
 {!quotes.length&&!inspections.length&&<p className="text-sm text-muted-foreground">No tienes presupuestos ni inspecciones pendientes de revisar.</p>}
 {complaints.length>0&&<p className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 text-xs">{complaints.length} reclamaciones siguen abiertas. Tu proveedor tiene el siguiente paso; consulta sus respuestas y el estado en seguimiento.</p>}
 </CardContent></Card>
 <Card><CardContent className="space-y-3"><h2 className="text-sm font-semibold">Servicios y documentación compartida</h2><p className="text-sm text-muted-foreground">Consulta los partes publicados, sus fotografías, los contratos y las facturas de {clientName}.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>onNavigate?.("services","all")}>Servicios y partes</Button><Button variant="outline" size="sm" onClick={()=>onNavigate?.("contracts","all")}>{overview.contracts.length} contratos</Button><Button variant="outline" size="sm" onClick={()=>onNavigate?.("invoices","all")}>{overview.invoices.length} facturas</Button></div></CardContent></Card>
 </section>;
}
