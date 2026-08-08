"use client";

import React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DocumentFormSelect,
    documentControlClassName,
} from "@/components/billing/DocumentFormControls";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { cn } from "@/lib/utils";

type CollaborationConnectFormProps = {
    inputCode: string;
    roleType: string;
    sending: boolean;
    loading: boolean;
    onInputCodeChange: (value: string) => void;
    onRoleTypeChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
};

export function CollaborationConnectForm({
    inputCode,
    roleType,
    sending,
    loading,
    onInputCodeChange,
    onRoleTypeChange,
    onSubmit,
}: CollaborationConnectFormProps) {
    return (
        <section className="billing-block flex h-full flex-col rounded-2xl p-3.5 sm:p-4">
            <header className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-card))] text-accent">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">
                        Vincular nueva empresa
                    </h3>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                        Introduce el código de partner y el tipo de relación.
                    </p>
                </div>
            </header>

            <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="collaboration-code" className="text-xs text-[var(--text-muted)]">
                            Código de partner
                        </Label>
                        <Input
                            id="collaboration-code"
                            required
                            type="text"
                            placeholder="Introduce el código de partner..."
                            value={inputCode}
                            onChange={(e) => onInputCodeChange(e.target.value.toUpperCase())}
                            className={cn(documentControlClassName, "uppercase placeholder:normal-case")}
                        />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor="collaboration-role" className="text-xs text-[var(--text-muted)]">
                            Tipo de vinculación
                        </Label>
                        <DocumentFormSelect
                            id="collaboration-role"
                            aria-label="Tipo de vinculación"
                            value={roleType}
                            onChange={(e) => onRoleTypeChange(e.target.value)}
                        >
                            <option value="service_provider">Prestará servicios</option>
                            <option value="property_manager">Solicitará servicios</option>
                        </DocumentFormSelect>
                    </div>
                </div>

                <div className="mt-auto flex justify-end pt-1">
                    <Button
                        type="submit"
                        disabled={sending || loading}
                        className={PAGE_ACTION_BUTTON_PRIMARY}
                    >
                        {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Solicitar vinculación
                    </Button>
                </div>
            </form>
        </section>
    );
}
