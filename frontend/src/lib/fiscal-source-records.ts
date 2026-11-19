type FiscalInvoice = { id: number; invoice_number: string; issue_date: string; status: string; base_amount: number; tax_amount: number; equivalence_surcharge: number; retention: number };
type FiscalExpense = { id: number; description: string; expense_date: string; base_amount: number; tax_amount: number };
type FiscalLedger = { source_type: string; source_id: number; document_number: string; entry_date: string; base_amount: number; tax_amount: number };
export type FiscalSourceRecord = { id: string; label: string; kind: "invoice" | "manual" | "expense"; date: string; base: number; outputVat: number; inputVat: number; surcharge: number; withholding: number; href?: string };
const billed = new Set(["issued", "partially_paid", "paid", "overdue", "rectified"]);
const money = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;

export function fiscalSourceRecords(invoices: FiscalInvoice[], expenses: FiscalExpense[], ledger: FiscalLedger[], year: number, period: string): FiscalSourceRecord[] {
    const included = (value: string) => value.slice(0, 4) === String(year) && (period === "annual" || `Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1}` === period);
    const reportable = invoices.filter((invoice) => billed.has(invoice.status) && included(invoice.issue_date));
    const numbers = new Set(invoices.filter((invoice) => billed.has(invoice.status) && invoice.issue_date.slice(0, 4) === String(year)).map((invoice) => invoice.invoice_number.trim().toLocaleLowerCase()));
    const invoiceRows: FiscalSourceRecord[] = reportable.map((invoice) => {
        const surcharge = money(invoice.base_amount * invoice.equivalence_surcharge / 100);
        return { id: `invoice-${invoice.id}`, label: invoice.invoice_number, kind: "invoice", date: invoice.issue_date, base: invoice.base_amount, outputVat: money(invoice.tax_amount - surcharge), inputVat: 0, surcharge, withholding: money(invoice.base_amount * invoice.retention / 100), href: `/dashboard/invoices?invoice=${invoice.id}` };
    });
    const manualRows: FiscalSourceRecord[] = ledger.filter((entry) => entry.source_type === "manual" && included(entry.entry_date) && !numbers.has(entry.document_number.trim().toLocaleLowerCase())).map((entry) => ({ id: `manual-${entry.source_id}`, label: entry.document_number, kind: "manual", date: entry.entry_date, base: entry.base_amount, outputVat: entry.tax_amount, inputVat: 0, surcharge: 0, withholding: 0 }));
    const expenseRows: FiscalSourceRecord[] = expenses.filter((expense) => included(expense.expense_date)).map((expense) => ({ id: `expense-${expense.id}`, label: expense.description, kind: "expense", date: expense.expense_date, base: expense.base_amount, outputVat: 0, inputVat: expense.tax_amount, surcharge: 0, withholding: 0 }));
    return [...invoiceRows, ...manualRows, ...expenseRows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
