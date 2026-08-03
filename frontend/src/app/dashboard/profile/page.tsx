"use client";

import React, { useState } from "react";
import { Mail, Briefcase, Loader2, AlertCircle, Building, Edit3, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
        <div className="max-w-7xl mx-auto space-y-8 pb-12 text-[var(--text-main)] animate-fade-in px-[3%] py-6 md:p-8">
            
            {/* Header and Profile */}
            <div className="relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20" />

                <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between relative z-10">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center text-center md:text-left">
                        <UserAvatar
                            name={state.user?.full_name}
                            email={state.user?.email}
                            photoUrl={state.user?.photo_url}
                            className="w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-accent/30 flex-shrink-0 text-xl md:text-2xl shadow-lg"
                            textClassName="text-xl md:text-2xl"
                        />

                        <div className="space-y-3">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                                    {state.user?.full_name || "Usuario"}
                                </h2>
                                <p className="text-sm text-[var(--text-muted)] flex items-center justify-center md:justify-start gap-2 mt-1 font-medium">
                                    <Mail className="h-4 w-4 text-accent/70" />
                                    {state.user?.email}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-3.5 py-1.5 rounded-full border border-accent/10">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    {state.user?.role?.name || "Sin Rol"}
                                </span>
                                {state.user?.company_id && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)] bg-[var(--bg-secondary)] px-3.5 py-1.5 rounded-full border border-[var(--border-color)]">
                                        <Building className="h-3.5 w-3.5 text-[var(--text-main)]/80" />
                                        {state.companyName || `#${state.user.company_id}`}
                                    </span>
                                )}
                                {state.partnerCode && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)] bg-[var(--bg-secondary)] px-3.5 py-1.5 rounded-full border border-[var(--border-color)]">
                                        <span>Código Partner: <span className="text-accent select-all font-mono font-bold">{state.partnerCode}</span></span>
                                        <button type="button" 
                                            onClick={() => {
                                                navigator.clipboard.writeText(state.partnerCode);
                                                toast.success("Código de partner copiado");
                                            }}
                                            className="hover:text-[var(--text-main)] transition-colors ml-1 cursor-pointer flex items-center justify-center"
                                            title="Copiar Código"
                                            aria-label="Copiar Código"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Profile Actions */}
                    <div className="flex flex-wrap gap-3 items-center">
                        {state.isAdminOrSuperadmin && (
                            <Button
                                onClick={() => setShowResetConfirm(true)}
                                variant="outline"
                                className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-2 cursor-pointer rounded-xl px-4 py-2"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                {state.dict.profile?.repeat_onboarding ?? "Repetir Onboarding"}
                            </Button>
                        )}
                        <Button
                            onClick={() => state.setIsEditing(!state.isEditing)}
                            variant="outline"
                            className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-2 cursor-pointer rounded-xl px-4 py-2"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            {state.isEditing ? (state.locale === "es" ? "Ver Datos" : "View Details") : (state.locale === "es" ? "Editar Datos" : "Edit Details")}
                        </Button>
                    </div>
                </div>

            </div>

            {/* SELF PROFILE EDIT FORM - Separated into its own premium module card */}
            {state.isEditing && state.user && (
                <div className="relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-6 md:p-8 shadow-xl animate-fade-in w-full">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20" />
                    
                    <div className="relative z-10 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                            <div>
                                <h3 className="text-lg font-black tracking-tight">
                                    {state.locale === "es" ? "Configuración de Cuenta" : "Account Settings"}
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                                    {state.locale === "es" 
                                        ? "Gestiona tus datos personales, información de la empresa y credenciales de acceso." 
                                        : "Manage your personal details, corporate info, and security credentials."}
                                </p>
                            </div>
                            <button type="button"
                                onClick={() => state.setIsEditing(false)}
                                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] px-3.5 py-2 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] ui-motion border border-[var(--border-color)]/30 cursor-pointer self-start sm:self-auto"
                            >
                                {state.locale === "es" ? "Cerrar Editor" : "Close Editor"}
                            </button>
                        </div>

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
                </div>
            )}

            <PrivacyControls
                locale={state.locale}
                canManageRequests={state.isAdminOrSuperadmin}
            />

            {/* Statistics Bento Grid */}
            <ProfileStats
                stats={state.stats}
                dict={state.dict}
                activeSession={state.activeSession}
                activeSessionTime={state.activeSessionTime}
                formatTime={state.formatTime}
            />

            {/* History Tabs and Tables */}
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
                            className="bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-xs font-semibold rounded-xl px-5 py-2.5 border-none cursor-pointer"
                        >
                            {state.locale === "es" ? "Aceptar" : "Accept"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
