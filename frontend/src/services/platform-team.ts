import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type PlatformMember = {
    id: number | null; email: string; invited_by: string | null; revoked_by: string | null;
    previously_activated: boolean;
    status: "pendiente" | "activa" | "revocada" | "caducada";
};
type InvitationResult = { email_sent: boolean; invitation_url: string | null };
const path = "/api/v1/platform-team";

export async function loadPlatformTeam(): Promise<PlatformMember[]> {
    const response = await apiFetch(path, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo cargar el equipo");
    return response.json();
}

export async function inviteTechnician(email: string) {
    const response = await apiFetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    await assertApiResponseOk(response, "No se pudo crear la invitación");
    return await response.json() as InvitationResult;
}

export async function resendInvitation(id: number) {
    const response = await apiFetch(path + "/" + id + "/resend", { method: "POST" });
    await assertApiResponseOk(response, "No se pudo reenviar la invitación");
    return await response.json() as InvitationResult;
}

export async function revokeTechnician(id: number) {
    await assertApiResponseOk(await apiFetch(path + "/" + id, { method: "DELETE" }), "No se pudo revocar el acceso");
}
