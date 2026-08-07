"use client";

import { useParams } from "next/navigation";
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView";

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const invoiceId = Number(id);

    return <InvoiceDetailView invoiceId={invoiceId} />;
}
