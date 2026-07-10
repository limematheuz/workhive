import { formatInvoiceNumber, formatQuoteNumber } from "@/lib/format";

function sanitizeFilenamePart(value: string): string {
    return value
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

export function buildInvoicePdfTitle(
    recipientName: string,
    invoiceNumber: string,
): string {
    const recipient = sanitizeFilenamePart(recipientName) || "Cliente";
    const number = sanitizeFilenamePart(formatInvoiceNumber(invoiceNumber));
    return `${recipient} - ${number}`;
}

export function buildQuotePdfTitle(
    recipientName: string,
    quoteNumber: string,
): string {
    const recipient = sanitizeFilenamePart(recipientName) || "Cliente";
    const number = sanitizeFilenamePart(formatQuoteNumber(quoteNumber));
    return `${recipient} - ${number}`;
}

export function printWithDocumentTitle(title: string, printFn: () => void): void {
    const previousTitle = document.title;
    document.title = title;

    const restoreTitle = () => {
        document.title = previousTitle;
        window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.setTimeout(restoreTitle, 2000);

    printFn();
}
