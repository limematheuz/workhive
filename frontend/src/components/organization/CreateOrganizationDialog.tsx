"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { permissionLabel } from "@/lib/organization-permission-label";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { OrganizationService, type OrganizationDepartment, type PermissionDefinition, type PermissionProfile } from "@/services/organization.service";

export type CreateKind = "department" | "team" | "profile" | null;

export function CreateOrganizationDialog({
    kind,
    profile,
    departments,
    definitions,
    onOpenChange,
    onCreated,
}: {
    kind: CreateKind;
    profile: PermissionProfile | null;
    departments: OrganizationDepartment[];
    definitions: PermissionDefinition[];
    onOpenChange: (open: boolean) => void;
    onCreated: () => Promise<void>;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.create_dialog;
    const profileCopy = dict.organization.profiles;
    const isProfile = kind === "profile" || profile !== null;
    const [name, setName] = useState(profile?.name ?? "");
    const [code, setCode] = useState("");
    const [departmentId, setDepartmentId] = useState<string>("");
    const [description, setDescription] = useState(profile?.description ?? "");
    const [permissionCodes, setPermissionCodes] = useState<string[]>(profile?.permission_codes ?? []);
    const [saving, setSaving] = useState(false);
    const selectedPermissionCodeSet = useMemo(
        () => new Set(permissionCodes),
        [permissionCodes],
    );
    const activeDepartments = useMemo(
        () => departments.filter((department) => department.is_active),
        [departments],
    );
    const definitionsByCategory = useMemo(() => {
        const grouped = new Map<string, PermissionDefinition[]>();
        for (const definition of definitions) {
            grouped.set(definition.category, [...(grouped.get(definition.category) ?? []), definition]);
        }
        return [...grouped.entries()];
    }, [definitions]);
    const categorySelection = (categoryDefinitions: PermissionDefinition[]) => {
        const codes: string[] = [];
        let allSelected = true;
        for (const definition of categoryDefinitions) {
            if (definition.is_system_only) continue;
            codes.push(definition.code);
            if (!selectedPermissionCodeSet.has(definition.code)) allSelected = false;
        }
        return { codes, allSelected: codes.length > 0 && allSelected };
    };
    const toggleCategory = (categoryDefinitions: PermissionDefinition[]) => {
        const { codes, allSelected } = categorySelection(categoryDefinitions);
        if (codes.length === 0) return;
        const codeSet = new Set(codes);
        setPermissionCodes((current) => allSelected
            ? current.filter((permissionCode) => !codeSet.has(permissionCode))
            : [...new Set([...current, ...codes])],
        );
    };
    const title = profile ? profileCopy.edit_title : kind === "department" ? copy.new_department : kind === "team" ? copy.new_team : copy.new_profile;
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            if (kind === "department") await OrganizationService.createDepartment({
                name,
                code: code || undefined,
                parent_department_id: departmentId && departmentId !== "none" ? Number(departmentId) : undefined,
            });
            if (kind === "team") await OrganizationService.createTeam({ name, code: code || undefined, department_id: departmentId && departmentId !== "none" ? Number(departmentId) : undefined });
            if (profile) await OrganizationService.updatePermissionProfile(profile.id, {
                name,
                description: description || null,
                permission_codes: permissionCodes,
            });
            if (kind === "profile" && !profile) await OrganizationService.createPermissionProfile({ name, description: description || undefined, permission_codes: permissionCodes });
            await onCreated();
            toast.success(profile ? profileCopy.updated : copy.saved);
        } catch (error) {
            toast.error(getErrorMessage(error, profile ? profileCopy.update_error : copy.save_error));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={kind !== null || profile !== null} onOpenChange={onOpenChange}>
            <DialogContent className="permission-profile-dialog max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0">
                <form onSubmit={handleSubmit} className="min-w-0">
                    <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-4 pr-14 sm:px-6">
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{profile?.is_system ? profileCopy.default_edit_description : profile ? profileCopy.edit_description : isProfile ? copy.profile_description : copy.structure_description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 px-5 py-4 sm:px-6">
                        <div className="space-y-2">
                            <Label htmlFor="organization-name">{copy.name}</Label>
                            <Input
                                id="organization-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                disabled={Boolean(profile?.is_system)}
                                required
                            />
                            {profile?.is_system && <p className="text-xs text-[var(--text-muted)]">{profileCopy.default_name_locked}</p>}
                        </div>
                        {!isProfile && (
                            <div className="space-y-2">
                                <Label htmlFor="organization-code">{copy.code_optional}</Label>
                                <Input id="organization-code" value={code} onChange={(event) => setCode(event.target.value)} />
                            </div>
                        )}
                        {kind === "department" && (
                            <div className="space-y-2">
                                <Label>{copy.parent_department_optional}</Label>
                                <Select value={departmentId || "none"} onValueChange={setDepartmentId}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{copy.no_parent_department}</SelectItem>
                                        {activeDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {kind === "team" && (
                            <div className="space-y-2">
                                <Label>{copy.department_optional}</Label>
                                <Select value={departmentId || "none"} onValueChange={setDepartmentId}>
                                    <SelectTrigger><SelectValue placeholder={copy.no_department} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{copy.no_department}</SelectItem>
                                        {activeDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {isProfile && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="organization-description">{copy.description_optional}</Label>
                                    <Input id="organization-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                                </div>
                                <FieldSet className="gap-2">
                                    <FieldLegend variant="label" className="mb-0 text-[var(--text-main)]">{copy.permissions}</FieldLegend>
                                    <div className="max-h-[min(42dvh,23rem)] space-y-2 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-2">
                                        {definitionsByCategory.map(([category, categoryDefinitions]) => (
                                            <PermissionCategory
                                                key={category}
                                                category={category}
                                                categoryDefinitions={categoryDefinitions}
                                                selectedPermissionCodeSet={selectedPermissionCodeSet}
                                                profileCopy={profileCopy}
                                                organizationCopy={dict.organization}
                                                categorySelection={categorySelection}
                                                toggleCategory={toggleCategory}
                                                onPermissionCodesChange={setPermissionCodes}
                                            />
                                        ))}
                                    </div>
                                </FieldSet>
                            </>
                        )}
                    </div>
                    <DialogFooter className="dialog-glass-chrome border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || (isProfile && permissionCodes.length === 0)}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {dict.organization.actions.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PermissionCategory({
    category,
    categoryDefinitions,
    selectedPermissionCodeSet,
    profileCopy,
    organizationCopy,
    categorySelection,
    toggleCategory,
    onPermissionCodesChange,
}: {
    category: string;
    categoryDefinitions: PermissionDefinition[];
    selectedPermissionCodeSet: Set<string>;
    profileCopy: ReturnType<typeof useDictionary>["dict"]["organization"]["profiles"];
    organizationCopy: ReturnType<typeof useDictionary>["dict"]["organization"];
    categorySelection: (definitions: PermissionDefinition[]) => { codes: string[]; allSelected: boolean };
    toggleCategory: (definitions: PermissionDefinition[]) => void;
    onPermissionCodesChange: React.Dispatch<React.SetStateAction<string[]>>;
}) {
    const selection = categorySelection(categoryDefinitions);
    const permissionGuidance = (definition: PermissionDefinition) => (
        (profileCopy.permission_guidance as Record<string, string>)[definition.code]
        || definition.description
    );

    return (
        <section className="space-y-1">
            <div className="flex min-h-7 items-center justify-between gap-3 px-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--btn-secondary-text)]">
                    {(profileCopy.permission_categories as Record<string, string>)[category] || category}
                </h3>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-[var(--btn-secondary-text)] hover:text-[var(--btn-secondary-hover-text)]"
                    disabled={selection.codes.length === 0}
                    onClick={() => toggleCategory(categoryDefinitions)}
                >
                    {selection.allSelected ? profileCopy.clear_category : profileCopy.select_category}
                </Button>
            </div>
            <div className="space-y-1">
                {categoryDefinitions.map((definition) => {
                    const isSelected = selectedPermissionCodeSet.has(definition.code);
                    const canRemoveLegacySelection = definition.is_system_only && isSelected;
                    return (
                        <Collapsible
                            key={definition.id}
                            className={cn(
                                "w-full min-w-0 rounded-lg border transition-colors",
                                isSelected
                                    ? "border-[color:var(--accent-color)]/60 bg-accent/10"
                                    : "border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--bg-secondary)]/45",
                                definition.is_system_only && !canRemoveLegacySelection
                                    ? "bg-[var(--bg-secondary)]/20"
                                    : "",
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-3 px-3 py-2">
                                <Checkbox
                                    id={`definition-${definition.id}`}
                                    className="shrink-0"
                                    checked={isSelected}
                                    disabled={definition.is_system_only && !canRemoveLegacySelection}
                                    onCheckedChange={(checked) => onPermissionCodesChange((current) => checked === true ? [...current, definition.code] : current.filter((item) => item !== definition.code))}
                                />
                                <Label
                                    htmlFor={`definition-${definition.id}`}
                                    className={cn(
                                        "min-w-0 flex-1 cursor-pointer text-sm font-medium leading-5 text-[var(--text-main)]",
                                        definition.is_system_only && !canRemoveLegacySelection && "cursor-not-allowed",
                                    )}
                                >
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span>{permissionLabel(definition.code, definition, organizationCopy)}</span>
                                        {definition.is_system_only && (
                                            <Badge variant="outline" className="border-[var(--border-soft)] bg-[var(--bg-secondary)]/60 px-1.5 py-0 text-[10px] font-medium leading-4 text-[var(--text-muted)]">
                                                {profileCopy.reserved_for_administrators}
                                            </Badge>
                                        )}
                                    </span>
                                </Label>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="group h-8 w-8 shrink-0 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                        aria-label={`${profileCopy.permission_details}: ${permissionLabel(definition.code, definition, organizationCopy)}`}
                                    >
                                        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                                    </Button>
                                </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="border-t border-[var(--border-soft)] px-3 py-2 pl-12">
                                <p className="text-xs leading-5 text-[var(--text-muted)]">{permissionGuidance(definition)}</p>
                                {definition.is_system_only && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{profileCopy.reserved_description}</p>}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>
        </section>
    );
}
