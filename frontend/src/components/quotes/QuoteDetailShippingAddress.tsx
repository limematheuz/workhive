type QuoteDetailShippingAddressProps = {
    shippingAddress: string | null | undefined;
};

export function QuoteDetailShippingAddress({ shippingAddress }: QuoteDetailShippingAddressProps) {
    if (!shippingAddress) {
        return null;
    }

    return (
        <div className="mt-4 bg-[var(--bg-primary)]/20 border border-[var(--border-soft)] rounded-2xl p-4 text-xs text-[var(--text-muted)] print:text-neutral-600 print:bg-neutral-50 print:border-neutral-200">
            <span className="font-bold text-[var(--text-main)] print:text-black block mb-1">Dirección de Envío / Ubicación de Servicio:</span>
            <div className="whitespace-pre-line">{shippingAddress}</div>
        </div>
    );
}
