"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createEditableLineKey } from "@/lib/editable-line-key";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { assignmentPayload, buildAssignmentDrafts, haveProfileAssignmentsChanged, hasInvalidDraftScopes, type AssignmentDraft } from "@/lib/organization-assignment-drafts";
import { MemberProfileScopeFields } from "@/components/organization/MemberProfileScopeFields";
import { LocationService, type Location } from "@/services/location.service";
import {
    OrganizationService,
    type OrganizationAccessClass,
    type OrganizationDepartment,
    type OrganizationMember,
    type OrganizationMembershipStatus,
    type OrganizationTeam,
    type PermissionProfile,
} from "@/services/organization.service";

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
const MEMBERSHIP_STATUSES: OrganizationMembershipStatus[] = ["active", "suspended"];

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
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationError, setLocationError] = useState(false);
    useEffect(() => {
        if (!open) return;
        let active = true;
        LocationService.getLocations().then(items => {
            if (active) setLocations(items);
        }).catch(() => { if (active) setLocationError(true); });
        return () => { active = false; };
    }, [open]);

    const availableProfiles = useMemo(
        () => profiles.filter((profile) => profile.is_editable && (profile.is_active || assignments.some(assignment => assignment.permission_profile_id === profile.id))),
        [profiles, assignments],
    );
    const profileAssignmentsChanged = Boolean(member && haveProfileAssignmentsChanged(member, profiles, assignments));
    const addingFirstProfile = Boolean(member?.legacy_role_name && member.profile_assignments.length === 0 && assignments.length > 0);

    const setProfileEnabled = (profileId: number, enabled: boolean) => {
        setAssignments((current) => enabled
            ? [...current, { permission_profile_id: profileId, scopes: [{ scope_type: "company", scope_id: companyId, draft_id: createEditableLineKey("member-scope") }] }]
            : current.filter((assignment) => assignment.permission_profile_id !== profileId));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!member) return;
        if (hasInvalidDraftScopes(assignments)) {
            toast.error(copy.invalid_scopes);
            return;
        }
        try {
            setSaving(true);
            await OrganizationService.updateMember(member.id, {
                access_class: accessClass,
                status: membershipStatus,
                department_ids: departmentIds,
                team_ids: teamIds,
                profile_assignments: profileAssignmentsChanged ? { assignments: assignmentPayload(assignments) } : undefined,
            });
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
                            {locationError && <p role="status" className="mt-1 text-xs text-[var(--text-muted)]">{copy.locations_unavailable}</p>}
                        </div>
                        {availableProfiles.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">{copy.profiles_empty}</p>
                        ) : availableProfiles.map((profile) => {
                            const assignment = assignments.find((item) => item.permission_profile_id === profile.id);
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
                                            {!profile.is_active && <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.inactive_profile}</p>}
                                        </div>
                                    </div>
                                    {assignment && (
                                        <MemberProfileScopeFields scopes={assignment.scopes}
                                            onChange={scopes => setAssignments(current => current.map(item => item.permission_profile_id === profile.id ? { ...item, scopes } : item))}
                                            companyId={companyId} departments={departments} teams={teams} locations={locations}
                                            disabled={!profile.is_active} name={profile.name} />
                                    )}
                                </div>
                            );
                        })}
                        {addingFirstProfile && <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-[var(--text-main)]">{copy.legacy_profile_transition}</p>}
                    </section>

                    <DialogFooter>
                        {canDelete && <Button type="button" variant="dangerSoft" onClick={onRequestDelete}>{dict.organization.actions.permanently_delete}</Button>}
                        <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || hasInvalidDraftScopes(assignments)}>
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
