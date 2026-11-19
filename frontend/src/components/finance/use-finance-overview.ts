"use client";

import { useCallback, useEffect, useState } from "react";
import { InvoiceService } from "@/services/invoice.service";
import { CustomerPaymentService, type CustomerPayment } from "@/services/customer-payment.service";
import type { Invoice } from "@/types/invoice";

export function useFinanceOverview() {
    const [invoices, setInvoices] = useState<Invoice[] | null>(null);
    const [payments, setPayments] = useState<CustomerPayment[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState<string[]>([]);
    const load = useCallback(async () => {
        setLoading(true);
        const [invoiceResult, paymentResult] = await Promise.allSettled([
            InvoiceService.getAllInvoices(), CustomerPaymentService.getPayments(),
        ]);
        const unavailable: string[] = [];
        if (invoiceResult.status === "fulfilled") setInvoices(invoiceResult.value);
        else { setInvoices(null); unavailable.push("saldos de facturas"); }
        if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
        else { setPayments(null); unavailable.push("cobros por fecha de recepción"); }
        setErrors(unavailable);
        setLoading(false);
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
    return { invoices, payments, loading, errors, reload: load };
}
