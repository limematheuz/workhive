import { formatCurrency, formatDate, formatQuoteNumber } from "@/lib/format"
import { splitStoredTaxAmount } from "@/lib/billing-calculations"
import { buildQuotePdfTitle } from "@/lib/document-print"
import { resolveApiMediaUrl } from "@/lib/api"
import { Quote } from "@/types/quote"
import { Client } from "@/services/client.service"
import { escapeHtml, escapeHtmlWithLineBreaks } from "@/lib/html"

interface PrintQuoteParams {
    quote: Quote
    clientName: string
    client?: Client
    companyName?: string
    companyLogo?: string | null
    getStatusLabel: (status: string) => string
}

export function printQuote({
    quote,
    clientName,
    client,
    companyName,
    companyLogo,
    getStatusLabel,
}: PrintQuoteParams): void {
    const resolveSafeImageUrl = (value?: string | null): string | null => {
        const resolvedUrl = resolveApiMediaUrl(value);
        if (!resolvedUrl) return null;
        if (/^data:image\/(?:gif|jpe?g|png|webp);base64,/i.test(resolvedUrl)) {
            return escapeHtml(resolvedUrl);
        }
        if (resolvedUrl.startsWith("blob:")) {
            return escapeHtml(resolvedUrl);
        }

        try {
            const parsedUrl = new URL(resolvedUrl, window.location.origin);
            if (
                !["http:", "https:"].includes(parsedUrl.protocol)
                || parsedUrl.origin !== window.location.origin
            ) {
                return null;
            }
            return escapeHtml(parsedUrl.toString());
        } catch {
            return null;
        }
    };

    const safeLogoUrl = resolveSafeImageUrl(companyLogo);
    const logoHtml = safeLogoUrl
        ? `<img src="${safeLogoUrl}" alt="Logo" style="height:60px;object-fit:contain;margin-bottom:8px;" />`
        : `<div style="font-size:24px;font-weight:900;margin-bottom:8px;">${escapeHtml(companyName ?? "WorkHive")}</div>`

    const itemsHtml = quote.items
        .map(
            (item) => `
            <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(item.description)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.quantity)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(item.unit_price))}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${escapeHtml(formatCurrency(item.subtotal))}</td>
            </tr>`
        )
        .join("")

    const taxPercent = Math.round((quote.tax_rate ?? 0.21) * 100)
    const subtotal = quote.items.reduce((acc, item) => acc + item.subtotal, 0)
    const discountAmount = subtotal * ((quote.discount || 0) / 100)
    const { pureVatAmount, surchargeAmount } = splitStoredTaxAmount(
        quote.tax_amount,
        quote.base_amount,
        quote.equivalence_surcharge || 0,
    )
    const retentionAmount = quote.base_amount * ((quote.retention || 0) / 100)

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(buildQuotePdfTitle(clientName, quote.quote_number))}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .logo-area { display: flex; flex-direction: column; }
        .meta-area { text-align: right; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        h1 { font-size: 28px; font-weight: 900; margin: 0 0 4px; }
        .quote-number { font-size: 14px; color: #6b7280; font-family: monospace; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .party { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
        .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
        .party-name { font-size: 13px; color: #374151; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #111; color: #fff; }
        thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
        thead th:last-child, thead th:nth-child(3) { text-align: right; }
        thead th:nth-child(2) { text-align: center; }
        .totals { margin-left: auto; width: 280px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
        .totals-row.total { font-size: 16px; font-weight: 900; color: #111; border-top: 2px solid #111; margin-top: 4px; padding-top: 8px; }
        .notes { margin-top: 28px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 12px; color: #6b7280; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #d1d5db; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
<div class="header">
    <div class="logo-area">
        ${logoHtml}
        <div style="font-size:12px;color:#6b7280;">Presupuesto / Quote</div>
    </div>
    <div class="meta-area">
        <h1>${escapeHtml(formatQuoteNumber(quote.quote_number))}</h1>
        <div class="quote-number">${escapeHtml(quote.title)}</div>
        <div style="margin-top:8px;font-size:12px;color:#6b7280;">Fecha: ${escapeHtml(formatDate(quote.created_at))}</div>
        ${quote.valid_until ? `<div style="font-size:12px;color:#6b7280;">Válido hasta: ${escapeHtml(formatDate(quote.valid_until))}</div>` : ""}
        <div style="margin-top:8px;"><span class="badge">${escapeHtml(getStatusLabel(quote.status))}</span></div>
    </div>
</div>

<div class="parties">
    <div class="party">
        <div class="party-label">Emisor</div>
        <div class="party-name">
            ${quote.custom_issuer_info
                ? escapeHtmlWithLineBreaks(quote.custom_issuer_info)
                : escapeHtml(companyName ?? "Mi Empresa")}
        </div>
    </div>
    <div class="party">
        <div class="party-label">Cliente</div>
        <div class="party-name">
            ${quote.custom_recipient_info
                ? escapeHtmlWithLineBreaks(quote.custom_recipient_info)
                : `<strong>${escapeHtml(clientName)}</strong>${client?.address ? `<br/>${escapeHtml(client.address)}` : ""}${client?.legal_number ? `<br/>NIF/CIF: ${escapeHtml(client.legal_number)}` : ""}`}
        </div>
        ${quote.shipping_address ? `<div style="margin-top: 10px; font-size: 11px; border-top: 1px dashed #e5e7eb; padding-top: 6px;"><strong style="font-size: 9px; text-transform: uppercase; color: #9ca3af; display: block; margin-bottom: 2px;">Dirección de envío:</strong>${escapeHtmlWithLineBreaks(quote.shipping_address)}</div>` : ""}
    </div>
</div>

<table>
    <thead>
        <tr>
            <th>Descripción</th>
            <th style="text-align:center;">Cant.</th>
            <th style="text-align:right;">Precio unit.</th>
            <th style="text-align:right;">Subtotal</th>
        </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
</table>

<div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
    ${quote.discount > 0 ? `<div class="totals-row"><span>Descuento (${quote.discount}%)</span><span>-${formatCurrency(discountAmount)}</span></div>` : ""}
    <div class="totals-row"><span>Base imponible</span><span>${formatCurrency(quote.base_amount)}</span></div>
    <div class="totals-row"><span>IVA (${taxPercent}%)</span><span>${formatCurrency(pureVatAmount)}</span></div>
    ${quote.equivalence_surcharge > 0 ? `<div class="totals-row"><span>Recargo Equiv. (${quote.equivalence_surcharge}%)</span><span>${formatCurrency(surchargeAmount)}</span></div>` : ""}
    ${quote.retention > 0 ? `<div class="totals-row" style="color:#ef4444;"><span>Retención IRPF (${quote.retention}%)</span><span>-${formatCurrency(retentionAmount)}</span></div>` : ""}
    <div class="totals-row total"><span>TOTAL</span><span>${formatCurrency(quote.total_amount)}</span></div>
</div>

${quote.notes ? `<div class="notes"><strong>Notas:</strong><br/>${escapeHtmlWithLineBreaks(quote.notes)}</div>` : ""}
${quote.terms ? `<div class="notes" style="margin-top: 10px;"><strong>Términos y condiciones:</strong><br/>${escapeHtmlWithLineBreaks(quote.terms)}</div>` : ""}
${resolveSafeImageUrl(quote.signature_url) ? `<div style="margin-top: 30px; text-align: right;"><strong style="font-size: 10px; text-transform: uppercase; color: #9ca3af; display: block; margin-bottom: 5px;">Firma del Emisor:</strong><img src="${resolveSafeImageUrl(quote.signature_url)}" alt="Firma" style="height: 60px; object-fit: contain;" /></div>` : ""}

<div class="footer">Documento generado por WorkHive · ${new Date().toLocaleDateString("es-ES")}</div>
</body>
</html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
        printWindow.opener = null
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        setTimeout(() => {
            printWindow.print()
        }, 500)
    }
}
