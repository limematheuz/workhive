import type { Client } from "@/services/client.service";
import type { Company } from "@/services/company.service";
import type { Quote } from "@/types/quote";

type QuoteDetailPartiesSectionProps = {
    quote: Quote;
    client: Client | null;
    company: Company | null;
    getClientName: (clientId: number | null) => string;
};

export function QuoteDetailPartiesSection({
    quote,
    client,
    company,
    getClientName,
}: QuoteDetailPartiesSectionProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 print:grid-cols-2">
            <div className="bg-gradient-to-br from-[var(--bg-primary)]/60 to-[var(--bg-primary)]/30 border border-[var(--border-soft)]/60 rounded-2xl p-6 relative overflow-hidden shadow-sm print:bg-white print:border-neutral-200">
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl pointer-events-none print:hidden" />
                <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-accent dark:text-accent block mb-3">Datos de Facturación del Emisor</span>
                    <h3 className="text-base font-black text-[var(--text-main)] print:text-black mb-4">{company?.name || "Emisor Comercial"}</h3>
                </div>
                <div className="text-xs text-[var(--text-muted)] space-y-2.5 mt-3 print:text-neutral-600 border-t border-[var(--border-soft)]/40 pt-4">
                    <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">CIF:</span> <span>{company?.tax_id || "-"}</span></p>
                    <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">Dirección:</span> <span className="text-right max-w-[180px] break-words">{company?.address || ""}</span></p>
                    <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">Email:</span> <span>{company?.email || ""}</span></p>
                </div>
            </div>

            <div className="bg-gradient-to-br from-[var(--bg-primary)]/60 to-[var(--bg-primary)]/30 border border-[var(--border-soft)]/60 rounded-2xl p-6 relative overflow-hidden shadow-sm print:bg-white print:border-neutral-200">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none print:hidden" />
                <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 block mb-3">Presupuesto preparado para</span>
                    <h3 className="text-base font-black text-[var(--text-main)] print:text-black mb-4">{getClientName(quote.client_id)}</h3>
                </div>
                <div className="text-xs text-[var(--text-muted)] space-y-2.5 mt-3 print:text-neutral-600 border-t border-[var(--border-soft)]/40 pt-4">
                    {quote.custom_recipient_info ? (
                        <p className="whitespace-pre-line leading-relaxed text-right">{quote.custom_recipient_info}</p>
                    ) : (
                        <>
                            <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">NIF/CIF:</span> <span>{client?.legal_number || "-"}</span></p>
                            <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">Dirección:</span> <span className="text-right max-w-[180px] break-words">{client?.address || ""}</span></p>
                            <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">Cód. Postal:</span> <span>{client?.postal_code || ""} {client?.city || ""}</span></p>
                            <p className="flex justify-between"><span className="font-semibold text-[var(--text-main)] print:text-black">País:</span> <span>{client?.country || ""}</span></p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
