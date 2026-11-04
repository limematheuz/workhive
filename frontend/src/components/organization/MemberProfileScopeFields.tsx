"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { createEditableLineKey } from "@/lib/editable-line-key";
import { replaceDraftScope, type ScopeDraft } from "@/lib/organization-assignment-drafts";
import type { OrganizationScopeType } from "@/services/organization.service";

type Target = { id: number; name: string; is_active?: boolean };

export function MemberProfileScopeFields({ scopes, onChange, companyId, departments, teams, locations, disabled, name }: {
    scopes: ScopeDraft[];
    onChange: (scopes: ScopeDraft[]) => void;
    companyId: number;
    departments: Target[];
    teams: Target[];
    locations: Target[];
    disabled: boolean;
    name: string;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.member_dialog;
    const options: Record<OrganizationScopeType, Target[]> = {
        company: [{ id: companyId, name: copy.scope_company }],
        department: departments,
        team: teams,
        location: locations,
    };
    const labels = { company: copy.scope_company, department: copy.scope_department, team: copy.scope_team, location: copy.scope_location };
    return <div className="mt-3 space-y-3 pl-8">
        {scopes.map((scope, index) => {
            const targets = options[scope.scope_type];
            return <div key={scope.draft_id ?? `${scope.scope_type}:${scope.scope_id}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Select disabled={disabled} value={scope.scope_type} onValueChange={value => {
                    const type = value as OrganizationScopeType;
                    onChange(replaceDraftScope(scopes, index, { scope_type: type, scope_id: options[type].find(target => target.is_active !== false)?.id ?? 0 }));
                }}>
                    <SelectTrigger aria-label={`${copy.scope_for.replace("{name}", name)} ${index + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(labels) as OrganizationScopeType[]).map(type => <SelectItem key={type} value={type} disabled={!options[type].some(target => target.is_active !== false)}>{labels[type]}</SelectItem>)}</SelectContent>
                </Select>
                <Select disabled={disabled} value={scope.scope_id ? String(scope.scope_id) : ""} onValueChange={value => {
                    // Replacing target options must not clear the new scope's initial target.
                    if (!value) return;
                    onChange(replaceDraftScope(scopes, index, { ...scope, scope_id: Number(value) }));
                }}>
                    <SelectTrigger aria-label={`${copy.target_for.replace("{name}", name)} ${index + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {scope.scope_id > 0 && !targets.some(target => target.id === scope.scope_id) && <SelectItem value={String(scope.scope_id)} disabled>{labels[scope.scope_type]} #{scope.scope_id}</SelectItem>}
                        {targets.map(target => <SelectItem key={target.id} value={String(target.id)} disabled={target.is_active === false && target.id !== scope.scope_id}>{target.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button type="button" variant="ghost" disabled={disabled || scopes.length === 1} onClick={() => onChange(scopes.filter((_, position) => position !== index))}>{copy.remove_scope}</Button>
            </div>;
        })}
        <Button type="button" variant="outline" size="sm" disabled={disabled || scopes.length >= 100} onClick={() => onChange([...scopes, { scope_type: "location", scope_id: 0, draft_id: createEditableLineKey("member-scope") }])}>{copy.add_scope}</Button>
    </div>;
}
