"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/user-context";
import { CollaborationService } from "@/services/collaboration.service";
import { CompanyCollaboration } from "@/types/collaboration";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { CollaborationPartnerCodeCard } from "@/components/collaborations/CollaborationPartnerCodeCard";
import { CollaborationConnectForm } from "@/components/collaborations/CollaborationConnectForm";
import { CollaborationRequestsPanel } from "@/components/collaborations/CollaborationRequestsPanel";
import { ActiveCollaboratorsPanel } from "@/components/collaborations/ActiveCollaboratorsPanel";

export default function CollaborationsPage() {
    const { user } = useUser();
    const [partnerCode, setPartnerCode] = useState<string>("");
    const [collaborations, setCollaborations] = useState<CompanyCollaboration[]>([]);
    const [pendingRequests, setPendingRequests] = useState<CompanyCollaboration[]>([]);
    const [sentRequests, setSentRequests] = useState<CompanyCollaboration[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [inputCode, setInputCode] = useState("");
    const [roleType, setRoleType] = useState("service_provider"); // or property_manager
    const [sending, setSending] = useState(false);

    // Unlink Modal state
    const [unlinkTarget, setUnlinkTarget] = useState<CompanyCollaboration | null>(null);
    const [unlinking, setUnlinking] = useState(false);

    const loadData = useCallback(async () => {
        const canLoad = ["admin", "manager"].includes(user?.role?.name || "") && Boolean(user?.company_id);
        if (!canLoad) {
            setLoading(false);
            return;
        }
        try {
            const [code, colls, pending, sent] = await Promise.all([
                CollaborationService.getPartnerCode(),
                CollaborationService.getCollaborations(),
                CollaborationService.getPendingRequests(),
                CollaborationService.getSentRequests(),
            ]);
            setPartnerCode(code);
            setCollaborations(colls);
            setPendingRequests(pending);
            setSentRequests(sent);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al cargar datos de colaboraciones");
        } finally {
            setLoading(false);
        }
    }, [user?.company_id, user?.role?.name]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadData();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadData]);

    useBackgroundPolling(loadData, POLL_INTERVALS.collaborations);

    const handleCopy = () => {
        if (!partnerCode) return;
        navigator.clipboard.writeText(partnerCode);
        toast.success("Código de partner copiado al portapapeles");
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputCode.trim()) {
            toast.error("Por favor, introduce un código de partner");
            return;
        }

        try {
            setSending(true);
            await CollaborationService.sendCollaborationRequest(inputCode.trim(), roleType);
            toast.success("Solicitud de colaboración enviada");
            setInputCode("");
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al enviar la solicitud");
        } finally {
            setSending(false);
        }
    };

    const handleAccept = async (id: number, name: string) => {
        try {
            await CollaborationService.acceptRequest(id);
            toast.success(`Vinculación con ${name} aceptada`);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al aceptar solicitud");
        }
    };

    const handleReject = async (id: number, name: string) => {
        try {
            await CollaborationService.rejectRequest(id);
            toast.success(`Solicitud de ${name} rechazada`);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al rechazar solicitud");
        }
    };

    const handleUnlink = async () => {
        if (!unlinkTarget) return;
        try {
            setUnlinking(true);
            await CollaborationService.deleteCollaboration(unlinkTarget.id);
            toast.success("Colaboración desvinculada correctamente");
            setUnlinkTarget(null);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al desvincular partner");
        } finally {
            setUnlinking(false);
        }
    };

    const canManage = ["admin", "manager"].includes(user?.role?.name || "") && Boolean(user?.company_id);

    if (!canManage) {
        return (
            <div className="max-w-3xl mx-auto p-8 text-center text-sm text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                {user?.role?.name === "superadmin"
                    ? "El superadmin gestiona la plataforma, pero no representa a una empresa y no tiene código partner."
                    : "Las colaboraciones se gestionan desde cuentas administradoras o gestoras de una empresa."}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-[3%] md:px-8 py-6 space-y-8 animate-fade-in text-[var(--text-main)]">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                    <Users className="h-6 w-6 text-accent" />
                    Colaboradores y Partners
                </h1>
                <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
                    Vincúlate con otras empresas para compartir lugares de trabajo y coordinar servicios.
                </p>
            </div>

            {/* Top Grid: Partner Code & Connect Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CollaborationPartnerCodeCard
                    partnerCode={partnerCode}
                    loading={loading}
                    onCopy={handleCopy}
                />
                <CollaborationConnectForm
                    inputCode={inputCode}
                    roleType={roleType}
                    sending={sending}
                    loading={loading}
                    onInputCodeChange={setInputCode}
                    onRoleTypeChange={setRoleType}
                    onSubmit={handleSendRequest}
                />
            </div>

            <CollaborationRequestsPanel
                pendingRequests={pendingRequests}
                sentRequests={sentRequests}
                onAccept={handleAccept}
                onReject={handleReject}
            />

            <ActiveCollaboratorsPanel
                collaborations={collaborations}
                loading={loading}
                companyId={user?.company_id}
                onUnlink={setUnlinkTarget}
            />

            {/* Unlink Confirmation Dialog */}
            <DeleteConfirmDialog
                open={unlinkTarget !== null}
                onOpenChange={(open) => !open && setUnlinkTarget(null)}
                title="¿Desvincular colaborador?"
                description="Esta acción eliminará los accesos compartidos entre vuestras empresas. Las tareas históricas y pendientes no se borrarán, pero dejaréis de ver las actualizaciones mutuas."
                onConfirm={handleUnlink}
                isDeleting={unlinking}
                confirmText="Confirmar desvinculación"
                cancelText="Cancelar"
            />

        </div>
    );
}
