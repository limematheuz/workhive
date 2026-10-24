"use client";

import { useState, type FormEvent } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryMovement } from "@/types/inventory";

type WorkOrderMaterialCorrectionDialogProps = {
    movement: InventoryMovement | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (movement: InventoryMovement, reason: string) => Promise<boolean>;
};

export function WorkOrderMaterialCorrectionDialog({
    movement,
    isSubmitting,
    onOpenChange,
    onConfirm,
}: WorkOrderMaterialCorrectionDialogProps) {
    const [reason, setReason] = useState("");

    const close = () => {
        setReason("");
        onOpenChange(false);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!movement || !reason.trim()) return;
        if (await onConfirm(movement, reason.trim())) close();
    };

    return <Dialog open={movement !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent compact>
            <DialogHeader>
                <DialogTitle>Corregir consumo</DialogTitle>
                <DialogDescription>La corrección añade una entrada de ajuste; el consumo original se conserva en el historial.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
                <div className="grid gap-2">
                    <Label htmlFor="work-order-material-correction-reason">Motivo de la corrección</Label>
                    <Textarea id="work-order-material-correction-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe el motivo de la corrección" rows={3} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="cancel" disabled={isSubmitting} onClick={close}>Cancelar</Button>
                    <Button type="submit" disabled={!reason.trim() || isSubmitting}>{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Corregir consumo</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>;
}
