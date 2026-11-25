"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import { useUser } from "@/lib/user-context";
import { inviteTechnician, loadPlatformTeam, resendInvitation, revokeTechnician, type PlatformMember } from "@/services/platform-team";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PlatformRoster, type TeamAction } from "./PlatformRoster";

export default function PlatformTeamPage() {
    const { user, loading } = useUser();
    const allowed = isPlatformSuperadmin(user);
    const [members, setMembers] = useState<PlatformMember[]>([]);
    const [email, setEmail] = useState("");
    const [inviteUrl, setInviteUrl] = useState("");
    const [notice, setNotice] = useState("");
    const [confirmMember, setConfirmMember] = useState<PlatformMember | null>(null);
    const [busy, setBusy] = useState(false);
    const rosterVersion = useRef(0);
    useEffect(() => {
        if (!allowed) return;
        let active = true;
        function refresh() {
            const version = ++rosterVersion.current;
            void loadPlatformTeam().then(rows => {
                if (active && version === rosterVersion.current) setMembers(rows);
            }).catch(() => {
                if (active && version === rosterVersion.current) setNotice("No se pudo cargar el equipo");
            });
        }
        refresh();
        window.addEventListener("focus", refresh);
        return () => {
            active = false;
            window.removeEventListener("focus", refresh);
        };
    }, [allowed]);
    async function updateTeam(action?: TeamAction) {
        if (busy || action?.member.id === null) return;
        setBusy(true);
        setInviteUrl("");
        try {
            if (action?.kind !== "revoke") {
                const recipient = action?.member.email ?? email.trim();
                const result = action?.kind === "resend" && action.member.id !== null
                    ? await resendInvitation(action.member.id) : await inviteTechnician(recipient);
                setInviteUrl(result.invitation_url ?? "");
                if (!action) setEmail("");
                setNotice(result.email_sent ? "Invitación enviada a " + recipient + "." : "Entrega este enlace en privado al técnico invitado.");
            } else {
                if (action.member.id === null) return;
                await revokeTechnician(action.member.id);
                setConfirmMember(null);
                setNotice(action.member.status === "pendiente" ? "Invitación cancelada." : "Acceso revocado.");
            }
            const version = ++rosterVersion.current;
            const rows = await loadPlatformTeam();
            if (version === rosterVersion.current) setMembers(rows);
        } catch (error) {
            setNotice(error instanceof Error ? error.message : "Error al actualizar el equipo");
        } finally { setBusy(false); }
    }
    if (loading) return <p>Cargando…</p>;
    if (!allowed) return <p>Acceso restringido al equipo de plataforma.</p>;
    return <main className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Equipo de plataforma</h1>
        <form className="space-y-3 rounded-xl border border-[var(--border-soft)] p-4" action={() => updateTeam()}>
            <label htmlFor="technical-email">Correo corporativo del técnico</label>
            <Input id="technical-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} />
            <p>Invita a un superadmin con un enlace de un solo uso válido durante 24 horas.</p>
            <Button disabled={busy}>Invitar técnico</Button>
        </form>
        <p role="status">{notice}</p>
        {inviteUrl && <Input aria-label="Enlace privado de invitación" readOnly value={inviteUrl} onFocus={event => event.target.select()} />}
        <PlatformRoster members={members} email={user?.email} busy={busy} onAction={action => {
            if (action.kind === "revoke") setConfirmMember(action.member);
            else void updateTeam(action);
        }} />
        {confirmMember && <DeleteConfirmDialog open onOpenChange={open => { if (!open) setConfirmMember(null); }}
            title={confirmMember.status === "pendiente" ? "¿Cancelar la invitación?" : "¿Revocar el acceso?"}
            description={confirmMember.status === "pendiente"
                ? "El enlace enviado a " + confirmMember.email + " dejará de funcionar."
                : confirmMember.email + " perderá el acceso y sus sesiones se cerrarán. Podrás volver a invitarle."}
            cancelText="Volver" confirmText={confirmMember.status === "pendiente" ? "Cancelar invitación" : "Revocar acceso"}
            isDeleting={busy} onConfirm={() => void updateTeam({ kind: "revoke", member: confirmMember })} />}
    </main>;
}
