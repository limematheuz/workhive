"use client";

import React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="surface-glass-card rounded-3xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-accent" />
                Vincular nueva empresa
            </h3>

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                        <input
                            required
                            type="text"
                            placeholder="Introduce el código de partner..."
                            value={inputCode}
                            onChange={(e) => onInputCodeChange(e.target.value.toUpperCase())}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-4 py-2.5 rounded-xl outline-none text-xs font-semibold focus:border-accent/50 transition-all uppercase placeholder:normal-case"
                        />
                    </div>
                    <div>
                        <select
                            aria-label="Tipo de vinculación"
                            value={roleType}
                            onChange={(e) => onRoleTypeChange(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[var(--text-main)] px-3 py-2.5 rounded-xl outline-none text-xs font-semibold cursor-pointer focus:border-accent/50 transition-all"
                        >
                            <option value="service_provider">Prestará servicios</option>
                            <option value="property_manager">Solicitará servicios</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={sending || loading}
                        className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                        {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Solicitar vinculación
                    </Button>
                </div>
            </form>
        </div>
    );
}
