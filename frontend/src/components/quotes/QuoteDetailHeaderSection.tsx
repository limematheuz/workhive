import Image from "next/image";
import { cn } from "@/lib/utils";
import { resolveApiMediaUrl } from "@/lib/api";
import { formatDateLong, formatQuoteNumber } from "@/lib/format";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Quote } from "@/types/quote";
import type { Company } from "@/services/company.service";

type QuoteDetailHeaderSectionProps = {
    dict: Dictionary;
    quote: Quote;
    company: Company | null;
    isEditMode: boolean;
    editTitle: string;
    onEditTitleChange: (value: string) => void;
    editValidUntil: string;
    onEditValidUntilChange: (value: string) => void;
    getStatusLabel: (status: string) => string;
};

export function QuoteDetailHeaderSection({
    dict,
    quote,
    company,
    isEditMode,
    editTitle,
    onEditTitleChange,
    editValidUntil,
    onEditValidUntilChange,
    getStatusLabel,
}: QuoteDetailHeaderSectionProps) {
    return (
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8 border-b-2 border-accent/10 pb-8 print:flex-row print:justify-between print:border-neutral-200">
            <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                    {company?.logo ? (
                        <Image
                            src={resolveApiMediaUrl(company.logo) || ""}
                            alt="Logo de Empresa"
                            width={200}
                            height={64}
                            className="max-h-16 max-w-[200px] object-contain print:max-h-14"
                            unoptimized
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md shadow-accent/20 print:border print:border-neutral-300 print:shadow-none">
                            {company?.name ? company.name.substring(0, 2).toUpperCase() : "WH"}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-accent/10 text-accent dark:text-accent uppercase tracking-widest inline-block mb-1 w-max">
                            Emisor
                        </span>
                        <span className="text-lg font-black tracking-tight text-[var(--text-main)] print:text-black">
                            {company?.name || "WorkHive Enterprise"}
                        </span>
                    </div>
                </div>
                <div className="text-xs text-[var(--text-muted)] space-y-1 print:text-neutral-600 whitespace-pre-line leading-relaxed pl-1 max-w-sm">
                    {quote.custom_issuer_info ? (
                        quote.custom_issuer_info
                    ) : (
                        <>
                            <p><span className="font-semibold text-[var(--text-main)] print:text-black">CIF:</span> {company?.tax_id || "-"}</p>
                            <p>{company?.address || "-"}</p>
                            <p>{company?.phone || "-"}</p>
                            <p>{company?.email || "-"}</p>
                        </>
                    )}
                </div>
            </div>

            <div className="text-left md:text-right print:text-right space-y-4">
                <div className="flex items-center gap-2 md:justify-end print:justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <h2 className="text-[10px] font-black uppercase tracking-wider text-accent dark:text-accent print:text-black">Presupuesto Comercial</h2>
                </div>
                {isEditMode ? (
                    <div className="mt-2 w-full md:max-w-[240px] ml-auto">
                        <label className="sr-only" htmlFor="quote-title">
                            Título del presupuesto
                        </label>
                        <input
                            id="quote-title"
                            type="text"
                            value={editTitle}
                            onChange={(e) => onEditTitleChange(e.target.value)}
                            placeholder="Título del presupuesto..."
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent transition-colors font-semibold"
                        />
                    </div>
                ) : (
                    <h1 className="text-3xl font-mono font-black text-[var(--text-main)] tracking-tight print:text-black">
                        <span className="text-accent/40 font-bold mr-0.5">#</span>{formatQuoteNumber(quote.quote_number)}
                    </h1>
                )}

                {!isEditMode && quote.title && (
                    <p className="text-xs text-[var(--text-muted)] font-medium mt-1 print:text-neutral-600 leading-normal">{quote.title}</p>
                )}

                <div className="flex flex-wrap md:justify-end gap-3 mt-4 print:mt-2">
                    <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-soft)]/50 rounded-2xl px-4 py-2 text-left min-w-[110px] print:border-neutral-200">
                        <span className="block text-[8px] uppercase font-bold text-[var(--text-muted)] tracking-wider">{dict.quotes?.created_label ?? "Fecha"}</span>
                        <span className="font-mono text-xs font-black text-[var(--text-main)] print:text-black">{formatDateLong(quote.created_at)}</span>
                    </div>
                    <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-soft)]/50 rounded-2xl px-4 py-2 text-left min-w-[110px] print:border-neutral-200">
                        <span className="block text-[8px] uppercase font-bold text-[var(--text-muted)] tracking-wider">{dict.quotes?.valid_until_label ?? "Válido hasta"}</span>
                        {isEditMode ? (
                            <input
                                type="date"
                                aria-label={dict.quotes?.valid_until_label ?? "Válido hasta"}
                                value={editValidUntil}
                                onChange={(e) => onEditValidUntilChange(e.target.value)}
                                className="bg-transparent border-none text-[var(--text-main)] p-0 text-xs outline-none focus:ring-0 transition-colors font-mono font-black w-24 h-4 mt-0.5"
                            />
                        ) : (
                            <span className="font-mono text-xs font-black text-[var(--text-main)] print:text-black">{quote.valid_until ? formatDateLong(quote.valid_until) : "-"}</span>
                        )}
                    </div>
                    <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-soft)]/50 rounded-2xl px-4 py-2 text-left min-w-[110px] print:hidden">
                        <span className="block text-[8px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Estado</span>
                        <span className={cn(
                            "block text-[9px] uppercase font-black tracking-wider mt-0.5",
                            quote.status === "accepted" ? "text-emerald-500" :
                            quote.status === "draft" ? "text-neutral-500" :
                            quote.status === "rejected" ? "text-rose-500" :
                            "text-amber-500"
                        )}>{getStatusLabel(quote.status)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
