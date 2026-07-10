"use client";

import { Mail, MapPin, Phone } from "lucide-react";

import { Client } from "@/services/client.service";

const formatFiscalAddress = (c: Client) => {
    const parts = [
        c.address?.trim(),
        c.postal_code?.trim(),
        c.city?.trim(),
    ].filter(Boolean);

    let result = parts.join(", ");
    if (c.country?.trim()) {
        result += result ? ` (${c.country.trim()})` : c.country.trim();
    }
    return result || "-";
};

type ClientDetailContactCardProps = {
    client: Client;
};

export function ClientDetailContactCard({ client }: ClientDetailContactCardProps) {
    return (
        <div className="flex flex-col gap-3.5 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] p-4 sm:p-5 rounded-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <Mail className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[var(--text-muted)]">Email:</span>
                    <span className="text-[var(--text-main)] truncate">{client.email || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <Phone className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[var(--text-muted)]">Teléfono:</span>
                    <span className="text-[var(--text-main)]">{client.phone || "-"}</span>
                </div>
            </div>
            <div className="border-t border-[var(--border-soft)]/60 pt-3 flex items-start gap-2 text-xs font-semibold">
                <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="flex flex-col sm:flex-row sm:gap-1.5 min-w-0 w-full">
                    <span className="text-[var(--text-muted)] shrink-0">Dirección Fiscal:</span>
                    <span className="text-[var(--text-main)] leading-relaxed truncate-normal break-words">
                        {formatFiscalAddress(client)}
                    </span>
                </div>
            </div>
        </div>
    );
}
