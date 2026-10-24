"use client";

import { useState, type FormEvent } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerPayment } from "@/services/customer-payment.service";

type CustomerPaymentVoidDialogProps = {
    payment: CustomerPayment | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (payment: CustomerPayment, reason: string) => Promise<boolean>;
};

export function CustomerPaymentVoidDialog({
    payment,
    isSubmitting,
    onOpenChange,
    onConfirm,
}: CustomerPaymentVoidDialogProps) {
    const [reason, setReason] = useState("");

    const close = () => {
        setReason("");
        onOpenChange(false);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!payment || !reason.trim()) return;
        if (await onConfirm(payment, reason.trim())) close();
    };

    return <Dialog open={payment !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent compact>
            <DialogHeader>
                <DialogTitle>Anular cobro</DialogTitle>
                <DialogDescription>El cobro se conservará en el historial como anulado y la factura volverá a reflejar su saldo pendiente.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
                <div className="grid gap-2">
                    <Label htmlFor="customer-payment-void-reason">Motivo de la anulación</Label>
                    <Textarea id="customer-payment-void-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe el motivo de la anulación" rows={3} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="cancel" disabled={isSubmitting} onClick={close}>Cancelar</Button>
                    <Button type="submit" variant="destructive" disabled={!reason.trim() || isSubmitting}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Anular cobro</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>;
}
