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
import { useDictionary } from "@/lib/dictionary-context";
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
    canDelete: boolean;
    onRequestDelete: () => void;
};

const ACCESS_CLASSES: OrganizationAccessClass[] = ["admin", "responsible", "worker"];
const MEMBERSHIP_STATUSES: OrganizationMembershipStatus[] = ["active", "suspended", "archived"];

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
    canDelete,
    onRequestDelete,
}: MemberAccessDialogProps) {
    const { dict } = useDictionary();
    const copy = dict.organization.member_dialog;
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
        if (scopeType === "company") return [{ id: companyId, name: copy.scope_company }];
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
            toast.success(copy.updated);
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.update_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="max-h-[90dvh] max-w-2xl overflow-y-auto">
                <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
                    <DialogHeader>
                        <DialogTitle>{copy.title.replace("{name}", member?.full_name || member?.email || "")}</DialogTitle>
                        <DialogDescription>{copy.description}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{copy.user_type}</Label>
                            <Select value={accessClass} onValueChange={(value) => setAccessClass(value as OrganizationAccessClass)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ACCESS_CLASSES.map((option) => <SelectItem key={option} value={option}>{dict.organization.access[option]}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{copy.status}</Label>
                            <Select value={membershipStatus} onValueChange={(value) => setMembershipStatus(value as OrganizationMembershipStatus)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MEMBERSHIP_STATUSES.map((option) => <SelectItem key={option} value={option}>{dict.organization.access[option]}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-5 rounded-2xl border border-[var(--border-soft)] p-4 sm:grid-cols-2">
                        <SelectionList title={copy.departments} items={departments} selectedIds={departmentIds} onToggle={(id) => setDepartmentIds(toggleMembershipId(departmentIds, id))} />
                        <SelectionList title={copy.teams} items={teams} selectedIds={teamIds} onToggle={(id) => setTeamIds(toggleMembershipId(teamIds, id))} />
                    </div>

                    <section className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--text-main)]">{copy.profiles_scope}</h3>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.profiles_scope_description}</p>
                        </div>
                        {availableProfiles.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">{copy.profiles_empty}</p>
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
                                                <SelectTrigger aria-label={copy.scope_for.replace("{name}", profile.name)}><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="company">{copy.scope_company}</SelectItem>
                                                    <SelectItem value="department" disabled={!departments.length}>{copy.scope_department}</SelectItem>
                                                    <SelectItem value="team" disabled={!teams.length}>{copy.scope_team}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={String(assignment.scopeId)} onValueChange={(value) => updateAssignment(profile.id, { scopeId: Number(value) })}>
                                                <SelectTrigger aria-label={copy.target_for.replace("{name}", profile.name)}><SelectValue /></SelectTrigger>
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
                        {canDelete && <Button type="button" variant="dangerSoft" onClick={onRequestDelete}>{dict.organization.actions.permanently_delete}</Button>}
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {dict.organization.actions.save_access}
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
    const { dict } = useDictionary();
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-main)]">{title}</h3>
            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                {items.length === 0 ? <p className="text-xs text-[var(--text-muted)]">{dict.organization.member_dialog.selection_empty}</p> : items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <Checkbox id={`${title}-${item.id}`} checked={selectedIdSet.has(item.id)} onCheckedChange={() => onToggle(item.id)} />
                        <Label htmlFor={`${title}-${item.id}`} className="cursor-pointer text-sm font-medium">{item.name}</Label>
                    </div>
                ))}
            </div>
        </section>
    );
}
