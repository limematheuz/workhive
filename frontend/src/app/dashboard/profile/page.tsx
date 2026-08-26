"use client";

import React, { useState } from "react";
import { Mail, Briefcase, Loader2, AlertCircle, Building, Edit3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfile } from "@/hooks/useProfile";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { ProfileHistories } from "@/components/profile/ProfileHistories";
import { PrivacyControls } from "@/components/profile/PrivacyControls";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";

export default function ProfilePage() {
    const state = useProfile();
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    if (state.loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] w-full text-[var(--text-muted)]">
                <Loader2 className="animate-spin h-10 w-10 text-accent mb-4" />
                <p className="text-sm font-medium animate-pulse">
                    {state.dict.dashboard?.loading || "Cargando..."}
                </p>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-black tracking-tight mb-2">Error</h3>
                <p className="text-[var(--text-muted)] text-sm max-w-md mb-6">{state.error}</p>
                <button type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl ui-motion text-sm font-semibold cursor-pointer"
                >
                    {state.locale === "es" ? "Reintentar" : "Retry"}
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl animate-fade-in space-y-5 px-[3%] py-6 pb-12 text-[var(--text-main)] md:p-8">
            {/* Identity hero */}
            <section className="billing-surface billing-surface-accent-pad relative overflow-hidden rounded-[24px]">
                <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />

                <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row lg:items-start">
                    <div className="flex flex-col items-center gap-5 text-center md:flex-row md:gap-6 md:text-left">
                        <UserAvatar
                            name={state.user?.full_name}
                            email={state.user?.email}
                            photoUrl={state.user?.photo_url}
                            className="h-20 w-20 shrink-0 rounded-full border border-accent/25 text-xl shadow-sm md:h-24 md:w-24 md:text-2xl"
                            textClassName="text-xl md:text-2xl"
                        />

                        <div className="min-w-0 space-y-3">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    {state.dict.profile?.title || "Perfil"}
                                </p>
                                <h1 className="mt-1 text-[clamp(1.35rem,1.8vw,1.9rem)] font-bold leading-none tracking-tight text-[var(--text-main)]">
                                    {state.user?.full_name || "Usuario"}
                                </h1>
                                <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] md:justify-start">
                                    <Mail className="h-4 w-4 text-accent" aria-hidden="true" />
                                    <span className="truncate">{state.user?.email}</span>
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                                <Badge
                                    variant="outline"
                                    className="border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent"
                                >
                                    <Briefcase className="h-3 w-3" aria-hidden="true" />
                                    {state.user?.role?.name || "Sin Rol"}
                                </Badge>
                                {!state.isAccountant && state.user?.company_id && (
                                    <Badge
                                        variant="secondary"
                                        className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                                    >
                                        <Building className="h-3 w-3" aria-hidden="true" />
                                        {state.companyName || `#${state.user.company_id}`}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-end">
                        {state.isAdminOrSuperadmin && (
                            <Button
                                type="button"
                                onClick={() => setShowResetConfirm(true)}
                                variant="outline"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                {state.dict.profile?.repeat_onboarding ?? "Repetir Onboarding"}
                            </Button>
                        )}
                        <Button
                            type="button"
                            onClick={() => state.setIsEditing(!state.isEditing)}
                            variant="outline"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            {state.isEditing
                                ? (state.locale === "es" ? "Ver Datos" : "View Details")
                                : (state.locale === "es" ? "Editar Datos" : "Edit Details")}
                        </Button>
                    </div>
                </div>
            </section>

            {state.isEditing && state.user && (
                <section className="billing-surface billing-surface-accent-pad relative w-full animate-fade-in overflow-hidden rounded-[24px]">
                    <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />

                    <div className="relative z-10 space-y-4">
                        <header className="flex flex-col justify-between gap-2.5 border-b border-[var(--border-soft)] pb-3 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-main)]">
                                    {state.locale === "es" ? "Configuración de Cuenta" : "Account Settings"}
                                </h2>
                                <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                                    {state.locale === "es"
                                        ? "Gestiona tus datos personales, información de la empresa y credenciales de acceso."
                                        : "Manage your personal details, corporate info, and security credentials."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => state.setIsEditing(false)}
                                className="btn-cancel-muted self-start sm:self-auto"
                            >
                                {state.locale === "es" ? "Cerrar Editor" : "Close Editor"}
                            </button>
                        </header>

                        <ProfileEditForm
                            user={state.user}
                            dict={state.dict}
                            onCancel={() => state.setIsEditing(false)}
                            onSuccess={async () => {
                                state.setIsEditing(false);
                                await state.refreshUser();
                                await state.loadProfileData();
                            }}
                        />
                    </div>
                </section>
            )}

            <PrivacyControls
                locale={state.locale}
                canManageRequests={state.isAdminOrSuperadmin}
            />

            {!state.isAccountant && (
                <>
                    <ProfileStats
                        stats={state.stats}
                        dict={state.dict}
                        activeSession={state.activeSession}
                        activeSessionTime={state.activeSessionTime}
                        formatTime={state.formatTime}
                    />

                    <ProfileHistories
                        activeTab={state.activeTab}
                        setActiveTab={state.setActiveTab}
                        sessions={state.sessions}
                        tasks={state.tasks}
                        locationsMap={state.locationsMap}
                        dict={state.dict}
                        formatDate={state.formatDate}
                        formatTime={state.formatTime}
                        calculateDuration={state.calculateDuration}
                        activeSessionTime={state.activeSessionTime}
                        activeCompanySessions={state.activeCompanySessions}
                        canViewActiveTeam={state.canViewActiveTeam}
                    />
                </>
            )}
            {/* Custom confirmation dialog */}
            <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {state.dict.profile?.repeat_onboarding ?? "Repetir Onboarding"}
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-sm text-[var(--text-muted)]">
                            {state.locale === "es" 
                                ? "¿Estás seguro de que quieres repetir el onboarding y la guía interactiva? Esto te redirigirá al panel principal." 
                                : "Are you sure you want to repeat the onboarding and guided tour? This will redirect you to the main dashboard."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 flex flex-row gap-3 justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowResetConfirm(false)}
                            className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer ui-motion"
                        >
                            {state.dict.clients?.form.cancel ?? "Cancelar"}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                localStorage.removeItem(`workhive_onboarding_done_${state.user?.id}`);
                                localStorage.removeItem(`workhive_guided_tour_done_${state.user?.id}`);
                                localStorage.setItem(`workhive_onboarding_forced_${state.user?.id}`, "true");
                                window.location.href = "/dashboard";
                            }}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            {state.locale === "es" ? "Aceptar" : "Accept"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
