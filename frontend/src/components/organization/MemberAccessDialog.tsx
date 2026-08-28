"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    OrganizationService,
    type OrganizationAccessClass,
    type OrganizationDepartment,
    type OrganizationMember,
    type OrganizationMembershipStatus,
    type OrganizationScopeType,
    type OrganizationTeam,
    type PermissionProfile,
} from "@/services/organization.service";

type AssignmentDraft = {
    profileId: number;
    scopeType: OrganizationScopeType;
    scopeId: number;
};

type MemberAccessDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: OrganizationMember | null;
    companyId: number;
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
    profiles: PermissionProfile[];
    onSaved: () => Promise<void>;
};

const ACCESS_CLASSES: Array<{ value: OrganizationAccessClass; label: string }> = [
    { value: "admin", label: "Administrador" },
    { value: "responsible", label: "Responsable" },
    { value: "worker", label: "Trabajador" },
];

const MEMBERSHIP_STATUSES: Array<{ value: OrganizationMembershipStatus; label: string }> = [
    { value: "active", label: "Activo" },
    { value: "suspended", label: "Suspendido" },
    { value: "archived", label: "Archivado" },
];

function buildAssignmentDrafts(
    member: OrganizationMember | null,
    profiles: PermissionProfile[],
): AssignmentDraft[] {
    if (!member) return [];
    const systemProfileIds = new Set<number>();
    for (const profile of profiles) {
        if (profile.is_system) systemProfileIds.add(profile.id);
    }
    const drafts: AssignmentDraft[] = [];
    for (const assignment of member.profile_assignments) {
        if (systemProfileIds.has(assignment.permission_profile_id)) continue;
        const scope = assignment.scopes[0];
        if (scope) {
            drafts.push({
                profileId: assignment.permission_profile_id,
                scopeType: scope.scope_type,
                scopeId: scope.scope_id,
            });
        }
    }
    return drafts;
}

function toggleMembershipId(ids: number[], id: number): number[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function MemberAccessDialog({
    open,
    onOpenChange,
    member,
    companyId,
    departments,
    teams,
    profiles,
    onSaved,
}: MemberAccessDialogProps) {
    const [accessClass, setAccessClass] = useState<OrganizationAccessClass>(member?.access_class ?? "worker");
    const [membershipStatus, setMembershipStatus] = useState<OrganizationMembershipStatus>(member?.status ?? "active");
    const [departmentIds, setDepartmentIds] = useState<number[]>(member?.department_ids ?? []);
    const [teamIds, setTeamIds] = useState<number[]>(member?.team_ids ?? []);
    const [assignments, setAssignments] = useState<AssignmentDraft[]>(() => buildAssignmentDrafts(member, profiles));
    const [saving, setSaving] = useState(false);

    const availableProfiles = useMemo(
        () => profiles.filter((profile) => !profile.is_system && profile.is_active),
        [profiles],
    );

    const setProfileEnabled = (profileId: number, enabled: boolean) => {
        setAssignments((current) => enabled
            ? [...current, { profileId, scopeType: "company", scopeId: companyId }]
            : current.filter((assignment) => assignment.profileId !== profileId));
    };

    const updateAssignment = (profileId: number, update: Partial<AssignmentDraft>) => {
        setAssignments((current) => current.map((assignment) => {
            if (assignment.profileId !== profileId) return assignment;
            const next = { ...assignment, ...update };
            if (update.scopeType === "company") next.scopeId = companyId;
            if (update.scopeType === "department") next.scopeId = departments[0]?.id ?? companyId;
            if (update.scopeType === "team") next.scopeId = teams[0]?.id ?? companyId;
            return next;
        }));
    };

    const scopeOptions = (scopeType: OrganizationScopeType) => {
        if (scopeType === "company") return [{ id: companyId, name: "Toda la empresa" }];
        if (scopeType === "department") return departments.map((department) => ({ id: department.id, name: department.name }));
        return teams.map((team) => ({ id: team.id, name: team.name }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!member) return;
        try {
            setSaving(true);
            await OrganizationService.updateMember(member.id, {
                access_class: accessClass,
                status: membershipStatus,
                department_ids: departmentIds,
                team_ids: teamIds,
            });
            await OrganizationService.replaceMemberProfileAssignments(
                member.id,
                assignments.map((assignment) => ({
                    permission_profile_id: assignment.profileId,
                    scopes: [{ scope_type: assignment.scopeType, scope_id: assignment.scopeId }],
                })),
            );
            await onSaved();
            toast.success("Accesos actualizados");
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron actualizar los accesos"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <DialogHeader>
                        <DialogTitle>Acceso de {member?.full_name || member?.email}</DialogTitle>
                        <DialogDescription>
                            El tipo indica su nivel dentro de la empresa. Los perfiles concretan qué puede hacer y dónde.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Tipo de usuario</Label>
                            <Select value={accessClass} onValueChange={(value) => setAccessClass(value as OrganizationAccessClass)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ACCESS_CLASSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select value={membershipStatus} onValueChange={(value) => setMembershipStatus(value as OrganizationMembershipStatus)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MEMBERSHIP_STATUSES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-5 rounded-2xl border border-[var(--border-soft)] p-4 sm:grid-cols-2">
                        <SelectionList title="Departamentos" items={departments} selectedIds={departmentIds} onToggle={(id) => setDepartmentIds(toggleMembershipId(departmentIds, id))} />
                        <SelectionList title="Equipos" items={teams} selectedIds={teamIds} onToggle={(id) => setTeamIds(toggleMembershipId(teamIds, id))} />
                    </div>

                    <section className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--text-main)]">Perfiles y ámbito</h3>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">Un perfil puede aplicarse a toda la empresa, a un departamento o a un equipo.</p>
                        </div>
                        {availableProfiles.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">Crea antes un perfil de permisos para asignarlo.</p>
                        ) : availableProfiles.map((profile) => {
                            const assignment = assignments.find((item) => item.profileId === profile.id);
                            const targets = assignment ? scopeOptions(assignment.scopeType) : [];
                            return (
                                <div key={profile.id} className="rounded-xl border border-[var(--border-soft)] p-3">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id={`profile-${profile.id}`}
                                            checked={Boolean(assignment)}
                                            onCheckedChange={(checked) => setProfileEnabled(profile.id, checked === true)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Label htmlFor={`profile-${profile.id}`} className="cursor-pointer">{profile.name}</Label>
                                            {profile.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{profile.description}</p>}
                                        </div>
                                    </div>
                                    {assignment && (
                                        <div className="mt-3 grid gap-3 pl-8 sm:grid-cols-2">
                                            <Select value={assignment.scopeType} onValueChange={(value) => updateAssignment(profile.id, { scopeType: value as OrganizationScopeType })}>
                                                <SelectTrigger aria-label={`Ámbito de ${profile.name}`}><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="company">Toda la empresa</SelectItem>
                                                    <SelectItem value="department" disabled={!departments.length}>Departamento</SelectItem>
                                                    <SelectItem value="team" disabled={!teams.length}>Equipo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={String(assignment.scopeId)} onValueChange={(value) => updateAssignment(profile.id, { scopeId: Number(value) })}>
                                                <SelectTrigger aria-label={`Destino de ${profile.name}`}><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {targets.map((target) => <SelectItem key={target.id} value={String(target.id)}>{target.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </section>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar acceso
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function SelectionList({
    title,
    items,
    selectedIds,
    onToggle,
}: {
    title: string;
    items: Array<{ id: number; name: string }>;
    selectedIds: number[];
    onToggle: (id: number) => void;
}) {
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-main)]">{title}</h3>
            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                {items.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Todavía no hay elementos.</p> : items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <Checkbox id={`${title}-${item.id}`} checked={selectedIdSet.has(item.id)} onCheckedChange={() => onToggle(item.id)} />
                        <Label htmlFor={`${title}-${item.id}`} className="cursor-pointer text-sm font-medium">{item.name}</Label>
                    </div>
                ))}
            </div>
        </section>
    );
}
