"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import { ActionPopover } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrganizationTableFilters } from "@/components/organization/OrganizationTableFilters";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { filterOrganizationDepartments, type DepartmentFilters } from "@/lib/organization-filters";
import { toast } from "@/lib/toast";
import {
    OrganizationService,
    type OrganizationDepartment,
    type OrganizationDepartmentUsage,
} from "@/services/organization.service";

type OrganizationDepartmentsPanelProps = {
    departments: OrganizationDepartment[];
    onChanged: () => Promise<void>;
};

const UNKNOWN_USAGE: OrganizationDepartmentUsage = {
    child_departments: 0,
    teams: 0,
    member_assignments: 0,
    profile_scopes: 0,
    can_delete: false,
};
const DEPARTMENTS_PAGE_SIZE = 20;

function departmentUsage(department: OrganizationDepartment) {
    return department.usage ?? UNKNOWN_USAGE;
}

export function OrganizationDepartmentsPanel({ departments, onChanged }: OrganizationDepartmentsPanelProps) {
    const { dict } = useDictionary();
    const copy = dict.organization.departments;
    const [editing, setEditing] = useState<OrganizationDepartment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<OrganizationDepartment | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DepartmentFilters>({
        search: "",
        status: "all",
        parentDepartmentId: "all",
    });
    const filteredDepartments = useMemo(
        () => filterOrganizationDepartments(departments, filters),
        [departments, filters],
    );
    const pagination = useDataTablePagination(filteredDepartments, DEPARTMENTS_PAGE_SIZE);
    const hasActiveFilters = filters.search.trim() !== "" || filters.status !== "all" || filters.parentDepartmentId !== "all";
    const updateFilters = (update: Partial<DepartmentFilters>) => {
        setFilters((current) => ({ ...current, ...update }));
        pagination.setPage(1);
    };
    const clearFilters = () => {
        setFilters({ search: "", status: "all", parentDepartmentId: "all" });
        pagination.setPage(1);
    };

    const deleteDepartment = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await OrganizationService.deleteDepartment(deleteTarget.id);
            setDeleteTarget(null);
            await onChanged();
            toast.success(copy.delete_success);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.delete_error));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <section className="billing-surface overflow-hidden rounded-[26px]">
            <header className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{copy.title}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.description}</p>
                </div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{filteredDepartments.length} {filteredDepartments.length === 1 ? copy.count_one : copy.count_many}</p>
            </header>
            <OrganizationTableFilters
                search={filters.search}
                onSearchChange={(search) => updateFilters({ search })}
                searchPlaceholder={dict.organization.filters.search_departments}
                shownCount={filteredDepartments.length}
                totalCount={departments.length}
                summary={dict.organization.filters.summary}
                clearLabel={dict.organization.filters.clear}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
            >
                <Select value={filters.status} onValueChange={(status) => updateFilters({ status: status as DepartmentFilters["status"] })}>
                    <SelectTrigger className="h-10 w-full sm:w-44" aria-label={dict.organization.people.columns.status}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{dict.organization.filters.all_statuses}</SelectItem>
                        <SelectItem value="active">{dict.organization.access.active}</SelectItem>
                        <SelectItem value="inactive">{dict.organization.access.inactive}</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.parentDepartmentId} onValueChange={(parentDepartmentId) => updateFilters({ parentDepartmentId })}>
                    <SelectTrigger className="h-10 w-full sm:w-60" aria-label={copy.parent}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{dict.organization.filters.all_parent_departments}</SelectItem>
                        <SelectItem value="none">{copy.no_parent}</SelectItem>
                        {departments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </OrganizationTableFilters>
            {filteredDepartments.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{departments.length === 0 ? copy.empty : dict.organization.filters.empty}</p>
            ) : (
                <>
                <Table className="table-fixed text-left">
                    <TableHeader>
                        <TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            <TableHead className="w-[52%] text-[var(--btn-secondary-text)] xl:w-[55%] 2xl:w-[38%]">{dict.organization.create_dialog.name}</TableHead>
                            <TableHead className="hidden w-[20%] text-[var(--btn-secondary-text)] xl:table-cell 2xl:w-[16%]">{copy.code}</TableHead>
                            <TableHead className="hidden w-[22%] text-[var(--btn-secondary-text)] 2xl:table-cell">{copy.parent}</TableHead>
                            <TableHead className="w-[28%] text-[var(--btn-secondary-text)] xl:w-[15%] 2xl:w-[16%]">{dict.organization.people.columns.status}</TableHead>
                            <TableHead className="w-[20%] text-right text-[var(--btn-secondary-text)] xl:w-[10%] 2xl:w-[8%]">{copy.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {pagination.pageItems.map((department) => (
                            <DepartmentRow
                                key={department.id}
                                department={department}
                                departments={departments}
                                onEdit={() => setEditing(department)}
                                onDelete={() => setDeleteTarget(department)}
                            />
                        ))}
                    </TableBody>
                </Table>
                <DataTablePagination
                    page={pagination.page}
                    totalItems={filteredDepartments.length}
                    pageSize={pagination.pageSize}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                    summary={dict.organization.pagination.summary.replace("{from}", String((pagination.page - 1) * pagination.pageSize + 1)).replace("{to}", String(Math.min(pagination.page * pagination.pageSize, filteredDepartments.length))).replace("{total}", String(filteredDepartments.length))}
                    rowsPerPageLabel={dict.organization.pagination.rows_per_page}
                    previousLabel={dict.organization.pagination.previous}
                    nextLabel={dict.organization.pagination.next}
                />
                </>
            )}

            {editing && (
                <DepartmentEditDialog
                    key={editing.id}
                    department={editing}
                    departments={departments}
                    onOpenChange={(open) => !open && setEditing(null)}
                    onSaved={async () => {
                        setEditing(null);
                        await onChanged();
                    }}
                    onRequestDelete={() => {
                        setEditing(null);
                        setDeleteTarget(editing);
                    }}
                />
            )}
            <DeleteConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title={copy.delete_title}
                description={copy.delete_description}
                onConfirm={() => void deleteDepartment()}
                isDeleting={deleting}
                confirmText={dict.organization.actions.delete}
                cancelText={dict.organization.actions.cancel}
            />
        </section>
    );
}

function DepartmentRow({
    department,
    departments,
    onEdit,
    onDelete,
}: {
    department: OrganizationDepartment;
    departments: OrganizationDepartment[];
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.departments;
    const usage = departmentUsage(department);
    const parentName = departments.find((item) => item.id === department.parent_department_id)?.name ?? copy.no_parent;

    return (
        <TableRow
            className="bg-[var(--bg-secondary)]/20 last:border-b-0 hover:brightness-[0.94]"
            onClick={onEdit}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit();
                }
            }}
            tabIndex={0}
            aria-label={`${dict.organization.actions.edit} ${department.name}`}
        >
            <TableCell>
                <p className="truncate font-semibold text-[var(--text-main)]">{department.name}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] xl:hidden">{department.code || copy.no_code} · {parentName}</p>
            </TableCell>
            <TableCell className="hidden text-sm text-[var(--text-muted)] xl:table-cell">{department.code || "—"}</TableCell>
            <TableCell className="hidden text-sm text-[var(--text-muted)] 2xl:table-cell">{parentName}</TableCell>
            <TableCell>
                <Badge variant="outline" className={department.is_active ? "border-accent/60 bg-accent/10 text-accent" : "border-[color:var(--text-muted)]/45 text-[var(--text-muted)]"}>
                    {department.is_active ? dict.organization.access.active : dict.organization.access.inactive}
                </Badge>
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <ActionPopover
                    align="end"
                    triggerLabel={`${copy.actions}: ${department.name}`}
                    options={[
                        { label: dict.organization.actions.edit, icon: Pencil, variant: "edit", onClick: onEdit },
                        ...(usage.can_delete
                            ? [{ label: dict.organization.actions.delete, icon: Trash2, variant: "delete" as const, onClick: onDelete }]
                            : []),
                    ]}
                />
            </TableCell>
        </TableRow>
    );
}

function DepartmentEditDialog({
    department,
    departments,
    onOpenChange,
    onSaved,
    onRequestDelete,
}: {
    department: OrganizationDepartment;
    departments: OrganizationDepartment[];
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<void>;
    onRequestDelete: () => void;
}) {
    const { dict } = useDictionary();
    const copy = dict.organization.departments;
    const [name, setName] = useState(department.name);
    const [code, setCode] = useState(department.code ?? "");
    const [parentId, setParentId] = useState(department.parent_department_id ? String(department.parent_department_id) : "none");
    const [isActive, setIsActive] = useState(department.is_active ? "active" : "inactive");
    const [saving, setSaving] = useState(false);
    const usage = departmentUsage(department);
    const availableParents = useMemo(
        () => departments.filter((item) => (
            item.id !== department.id
            && (item.is_active || item.id === department.parent_department_id)
            && !wouldCreateDepartmentCycle(department.id, item.id, departments)
        )),
        [department.id, department.parent_department_id, departments],
    );
    const dependencies = [
        { count: usage.child_departments, label: copy.child_departments },
        { count: usage.teams, label: copy.teams },
        { count: usage.member_assignments, label: copy.member_assignments },
        { count: usage.profile_scopes, label: copy.profile_scopes },
    ].filter((item) => item.count > 0);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            await OrganizationService.updateDepartment(department.id, {
                name: name.trim(),
                code: code.trim() || null,
                parent_department_id: parentId === "none" ? null : Number(parentId),
                is_active: isActive === "active",
            });
            await onSaved();
            toast.success(copy.updated);
        } catch (error) {
            toast.error(getErrorMessage(error, copy.update_error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent compact className="max-h-[90dvh] max-w-xl overflow-y-auto">
                <form onSubmit={save} className="min-w-0 space-y-5">
                    <DialogHeader>
                        <DialogTitle>{copy.edit_title}</DialogTitle>
                        <DialogDescription>{copy.edit_description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="department-name">{dict.organization.create_dialog.name}</Label>
                        <Input id="department-name" value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-code">{dict.organization.create_dialog.code_optional}</Label>
                        <Input id="department-code" value={code} onChange={(event) => setCode(event.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{copy.parent_optional}</Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{copy.no_parent}</SelectItem>
                                    {availableParents.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{dict.organization.people.columns.status}</Label>
                            <Select value={isActive} onValueChange={setIsActive}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">{dict.organization.access.active}</SelectItem>
                                    <SelectItem value="inactive">{dict.organization.access.inactive}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {!usage.can_delete && (
                        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/45 p-3 text-sm text-[var(--text-muted)]">
                            <p className="font-medium text-[var(--text-main)]">{copy.linked_data_title}</p>
                            <p className="mt-1 text-xs leading-5">{copy.linked_data_description}</p>
                            <p className="mt-2 text-xs">{dependencies.map((item) => `${item.count} ${item.label}`).join(" · ")}</p>
                        </div>
                    )}
                    <DialogFooter>
                        {usage.can_delete && <Button type="button" variant="dangerSoft" onClick={onRequestDelete}>{dict.organization.actions.delete}</Button>}
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.organization.actions.cancel}</Button>
                        <Button type="submit" disabled={saving || !name.trim()}>
                            {saving && <Loader2 className="mr-2 animate-spin" aria-hidden="true" />}
                            {dict.organization.actions.save}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function wouldCreateDepartmentCycle(
    departmentId: number,
    candidateParentId: number,
    departments: OrganizationDepartment[],
) {
    const departmentsById = new Map(departments.map((item) => [item.id, item]));
    const visited = new Set<number>();
    let currentId: number | null = candidateParentId;
    while (currentId !== null && !visited.has(currentId)) {
        if (currentId === departmentId) return true;
        visited.add(currentId);
        currentId = departmentsById.get(currentId)?.parent_department_id ?? null;
    }
    return false;
}
