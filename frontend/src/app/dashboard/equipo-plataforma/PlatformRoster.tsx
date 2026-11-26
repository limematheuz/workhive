import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlatformMember } from "@/services/platform-team";

const labels = {
    activa: "Acceso activo",
    pendiente: "Pendiente de aceptación",
    revocada: "Acceso revocado",
    caducada: "Invitación caducada",
} as const;

export type TeamAction = { kind: "resend" | "reinvite" | "revoke"; member: PlatformMember };

export function PlatformRoster({ members, email, busy, onAction }: {
    members: PlatformMember[]; email?: string; busy: boolean; onAction: (action: TeamAction) => void;
}) {
    return <ul className="divide-y divide-[var(--border-soft)] overflow-hidden rounded-xl border border-[var(--border-soft)]">
        {members.map(member => {
            const own = member.email === email;
            const mutable = member.id !== null && !own;
            const pending = member.status === "pendiente";
            const status = member.status === "revocada" && !member.previously_activated
                ? "Invitación cancelada" : labels[member.status];
            return <li key={member.email} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                    <p className="break-all font-medium">{member.email}{own && " (tú)"}</p>
                    <Badge variant={member.status === "activa" ? "secondary" : "outline"}>{status}</Badge>
                </div>
                {mutable && <div className="flex flex-wrap gap-2">
                    {member.status === "revocada" &&
                        <Button variant="outline" disabled={busy} onClick={() => onAction({ kind: "reinvite", member })}>Volver a invitar</Button>}
                    {(pending || member.status === "caducada") &&
                        <Button variant="outline" disabled={busy} onClick={() => onAction({ kind: "resend", member })}>Reenviar invitación</Button>}
                    {(pending || member.status === "activa") &&
                        <Button variant="ghost" disabled={busy} onClick={() => onAction({ kind: "revoke", member })}>
                            {pending ? "Cancelar invitación" : "Revocar acceso"}
                        </Button>}
                </div>}
            </li>;
        })}
    </ul>;
}
