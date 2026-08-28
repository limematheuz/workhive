"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Building2, Layers3, Loader2, Plus, ShieldCheck, UsersRound } from "lucide-react";

import { MemberAccessDialog } from "@/components/organization/MemberAccessDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataListTable } from "@/components/ui/data-list-table";
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
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import {
    OrganizationService,
    type OrganizationDepartment,
    type OrganizationMember,
    type OrganizationTeam,
    type PermissionDefinition,
    type PermissionProfile,
} from "@/services/organization.service";

type OrganizationTab = "people" | "departments" | "teams" | "profiles";
type CreateKind = "department" | "team" | "profile" | null;

type OrganizationData = {
    members: OrganizationMember[];
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
    definitions: PermissionDefinition[];
    profiles: PermissionProfile[];
};

const EMPTY_DATA: OrganizationData = {
    members: [], departments: [], teams: [], definitions: [], profiles: [],
};
const MEMBERSHIP_STATUS_LABELS = {
    active: "Activo",
    suspended: "Suspendido",
    archived: "Archivado",
} as const;

export function OrganizationControlCenter() {
    const { user, loading: userLoading } = useUser();
    const [data, setData] = useState<OrganizationData>(EMPTY_DATA);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [tab, setTab] = useState<OrganizationTab>("people");
    const [createKind, setCreateKind] = useState<CreateKind>(null);
    const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);

    const companyId = user?.company_id ?? null;
    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const [members, departments, teams, definitions, profiles] = await Promise.all([
                OrganizationService.getMembers(),
                OrganizationService.getDepartments(),
                OrganizationService.getTeams(),
                OrganizationService.getPermissionDefinitions(),
                OrganizationService.getPermissionProfiles(),
            ]);
            setData({ members, departments, teams, definitions, profiles });
        } catch (error) {
            setLoadError(getErrorMessage(error, "No se pudo cargar la configuración de la organización"));
        } finally {
            setLoading(false);
        }
    }, [companyId]);
    const loadEvent = useEffectEvent(load);

    useEffect(() => {
        if (!userLoading) startTransition(() => { void loadEvent(); });
    }, [userLoading]);

    const actionLabel = useMemo(() => ({
        people: "Gestionar personas",
        departments: "Añadir departamento",
        teams: "Añadir equipo",
        profiles: "Crear perfil",
    })[tab], [tab]);

    const openAction = () => {
        if (tab === "people") return;
        setCreateKind(tab === "departments" ? "department" : tab === "teams" ? "team" : "profile");
    };

    if (!companyId && !userLoading) {
        return <RestrictedOrganizationState message="La configuración de una organización solo está disponible dentro de una empresa." />;
    }

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={Building2}
                title="Organización y accesos"
                subtitle="Define la estructura interna y controla qué puede hacer cada persona dentro de su ámbito."
                className="mb-7"
                actions={(
                    <Button type="button" onClick={openAction} disabled={tab === "people"}>
                        <Plus className="mr-2 h-4 w-4" />{actionLabel}
                    </Button>
                )}
            />

            <PremiumTabs<OrganizationTab>
                className="mb-6"
                layout="scroll"
                tabs={[
                    { id: "people", label: "Personas", icon: UsersRound },
                    { id: "departments", label: "Departamentos", icon: Building2 },
                    { id: "teams", label: "Equipos", icon: Layers3 },
                    { id: "profiles", label: "Perfiles", icon: ShieldCheck },
                ]}
                activeTab={tab}
                onChange={setTab}
            />

            {loading ? <LoadingState /> : loadError ? <RestrictedOrganizationState message={loadError} /> : (
                <>
                    {tab === "people" && <MembersTable members={data.members} onSelect={setSelectedMember} />}
                    {tab === "departments" && <DepartmentsTable departments={data.departments} />}
                    {tab === "teams" && <TeamsTable teams={data.teams} departments={data.departments} />}
                    {tab === "profiles" && <ProfilesTable profiles={data.profiles} />}
                </>
            )}

            <CreateOrganizationDialog
                key={createKind ?? "closed"}
                kind={createKind}
                departments={data.departments}
                definitions={data.definitions}
                onOpenChange={(open) => !open && setCreateKind(null)}
                onCreated={async () => {
                    setCreateKind(null);
                    await load();
                }}
            />
            {companyId && (
                <MemberAccessDialog
                    key={selectedMember?.id ?? "none"}
                    open={selectedMember !== null}
                    onOpenChange={(open) => !open && setSelectedMember(null)}
                    member={selectedMember}
                    companyId={companyId}
                    departments={data.departments}
                    teams={data.teams}
                    profiles={data.profiles}
                    onSaved={load}
                />
            )}
        </div>
    );
}

function MembersTable({ members, onSelect }: { members: OrganizationMember[]; onSelect: (member: OrganizationMember) => void }) {
    return (
        <DataListTable
            items={members}
            getRowKey={(member) => member.id}
            gridClassName="grid-cols-[minmax(12rem,1.4fr)_9rem_8rem_minmax(12rem,1fr)]"
            onRowClick={onSelect}
            rowAriaLabel={(member) => `Configurar accesos de ${member.full_name || member.email}`}
            header={{ title: "Personas internas", subtitle: "Pulsa una persona para definir su tipo, equipos, departamentos y perfiles.", countLabel: `${members.length} personas` }}
            columns={[
                { key: "person", label: "Persona" },
                { key: "class", label: "Tipo" },
                { key: "status", label: "Estado" },
                { key: "profiles", label: "Perfiles" },
            ]}
            empty={<p className="text-sm text-[var(--text-muted)]">Aún no hay personas internas.</p>}
            renderCompactRow={(member) => <MemberRow member={member} compact />}
            renderDesktopRow={(member) => <MemberRow member={member} />}
        />
    );
}

function MemberRow({ member, compact = false }: { member: OrganizationMember; compact?: boolean }) {
    const accessLabel = { admin: "Administrador", responsible: "Responsable", worker: "Trabajador" }[member.access_class];
    const profileText = member.profile_assignments.map((assignment) => assignment.permission_profile_name).join(", ") || "Sin perfil adicional";
    if (compact) {
        return <><p className="font-semibold text-[var(--text-main)]">{member.full_name || member.email}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{member.email}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={member.status} /><Badge variant="outline">{accessLabel}</Badge></div><p className="mt-3 text-xs text-[var(--text-muted)]">{profileText}</p></>;
    }
    return <><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{member.full_name || member.email}</p><p className="truncate text-xs text-[var(--text-muted)]">{member.email}</p></div><Badge variant="outline" className="w-fit">{accessLabel}</Badge><StatusBadge status={member.status} /><p className="truncate text-sm text-[var(--text-muted)]">{profileText}</p></>;
}

function StatusBadge({ status }: { status: OrganizationMember["status"] }) {
    return <Badge variant="outline" className={status === "active" ? "border-accent/25 bg-accent/10 text-accent" : "text-[var(--text-muted)]"}>{MEMBERSHIP_STATUS_LABELS[status]}</Badge>;
}

function DepartmentsTable({ departments }: { departments: OrganizationDepartment[] }) {
    const parentName = (department: OrganizationDepartment) => departments.find((item) => item.id === department.parent_department_id)?.name || "—";
    return <DataListTable items={departments} getRowKey={(department) => department.id} gridClassName="grid-cols-[minmax(12rem,1.5fr)_9rem_10rem_7rem]" header={{ title: "Departamentos", subtitle: "Agrupan responsabilidades como Comercial, RRHH, Operaciones, Finanzas o Calidad.", countLabel: `${departments.length} departamentos` }} columns={[{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "parent", label: "Depende de" }, { key: "state", label: "Estado" }]} empty={<p className="text-sm text-[var(--text-muted)]">Crea el primer departamento de la empresa.</p>} renderCompactRow={(department) => <><p className="font-semibold">{department.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{department.code || "Sin código"} · {parentName(department)}</p></>} renderDesktopRow={(department) => <><p className="font-semibold">{department.name}</p><p className="text-sm text-[var(--text-muted)]">{department.code || "—"}</p><p className="text-sm text-[var(--text-muted)]">{parentName(department)}</p><Badge variant="outline">{department.is_active ? "Activo" : "Inactivo"}</Badge></>} />;
}

function TeamsTable({ teams, departments }: { teams: OrganizationTeam[]; departments: OrganizationDepartment[] }) {
    const departmentName = (team: OrganizationTeam) => departments.find((department) => department.id === team.department_id)?.name || "Sin departamento";
    return <DataListTable items={teams} getRowKey={(team) => team.id} gridClassName="grid-cols-[minmax(12rem,1.5fr)_9rem_10rem_7rem]" header={{ title: "Equipos", subtitle: "Agrupan personas operativas y permiten limitar el ámbito de responsables.", countLabel: `${teams.length} equipos` }} columns={[{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "department", label: "Departamento" }, { key: "state", label: "Estado" }]} empty={<p className="text-sm text-[var(--text-muted)]">Crea el primer equipo de trabajo.</p>} renderCompactRow={(team) => <><p className="font-semibold">{team.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{team.code || "Sin código"} · {departmentName(team)}</p></>} renderDesktopRow={(team) => <><p className="font-semibold">{team.name}</p><p className="text-sm text-[var(--text-muted)]">{team.code || "—"}</p><p className="text-sm text-[var(--text-muted)]">{departmentName(team)}</p><Badge variant="outline">{team.is_active ? "Activo" : "Inactivo"}</Badge></>} />;
}

function ProfilesTable({ profiles }: { profiles: PermissionProfile[] }) {
    return <DataListTable items={profiles} getRowKey={(profile) => profile.id} gridClassName="grid-cols-[minmax(12rem,1.2fr)_minmax(14rem,1.8fr)_8rem_7rem]" header={{ title: "Perfiles de permisos", subtitle: "Un perfil reúne acciones permitidas; luego se asigna a cada persona con el ámbito necesario.", countLabel: `${profiles.length} perfiles` }} columns={[{ key: "name", label: "Perfil" }, { key: "permissions", label: "Permisos" }, { key: "type", label: "Tipo" }, { key: "state", label: "Estado" }]} empty={<p className="text-sm text-[var(--text-muted)]">Crea perfiles para Comercial, RRHH, Calidad u Operaciones.</p>} renderCompactRow={(profile) => <><p className="font-semibold">{profile.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{profile.permission_codes.length} permisos</p><p className="mt-2 text-xs text-[var(--text-muted)]">{profile.description || "Sin descripción"}</p></>} renderDesktopRow={(profile) => <><div><p className="font-semibold">{profile.name}</p><p className="text-xs text-[var(--text-muted)]">{profile.description || "Sin descripción"}</p></div><p className="truncate text-sm text-[var(--text-muted)]">{profile.permission_codes.join(", ")}</p><Badge variant="outline">{profile.is_system ? "Sistema" : "Personalizado"}</Badge><Badge variant="outline">{profile.is_active ? "Activo" : "Inactivo"}</Badge></>} />;
}

function CreateOrganizationDialog({ kind, departments, definitions, onOpenChange, onCreated }: { kind: CreateKind; departments: OrganizationDepartment[]; definitions: PermissionDefinition[]; onOpenChange: (open: boolean) => void; onCreated: () => Promise<void> }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [departmentId, setDepartmentId] = useState<string>("");
    const [description, setDescription] = useState("");
    const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const selectedPermissionCodeSet = useMemo(
        () => new Set(permissionCodes),
        [permissionCodes],
    );

    const title = kind === "department" ? "Nuevo departamento" : kind === "team" ? "Nuevo equipo" : "Nuevo perfil de permisos";
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            if (kind === "department") await OrganizationService.createDepartment({ name, code: code || undefined });
            if (kind === "team") await OrganizationService.createTeam({ name, code: code || undefined, department_id: departmentId ? Number(departmentId) : undefined });
            if (kind === "profile") await OrganizationService.createPermissionProfile({ name, description: description || undefined, permission_codes: permissionCodes });
            await onCreated();
            toast.success("Configuración guardada");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo guardar la configuración"));
        } finally { setSaving(false); }
    };
    return <Dialog open={kind !== null} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={handleSubmit} className="space-y-5"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{kind === "profile" ? "Elige exactamente las acciones que este perfil podrá realizar." : "Podrás completar y reorganizar esta estructura más adelante."}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="organization-name">Nombre</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>{kind !== "profile" && <div className="space-y-2"><Label htmlFor="organization-code">Código (opcional)</Label><Input id="organization-code" value={code} onChange={(event) => setCode(event.target.value)} /></div>}{kind === "team" && <div className="space-y-2"><Label>Departamento (opcional)</Label><Select value={departmentId} onValueChange={setDepartmentId}><SelectTrigger><SelectValue placeholder="Sin departamento" /></SelectTrigger><SelectContent>{departments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}</SelectContent></Select></div>}{kind === "profile" && <><div className="space-y-2"><Label htmlFor="organization-description">Descripción (opcional)</Label><Input id="organization-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><fieldset className="space-y-2"><legend className="text-sm font-medium text-[var(--text-main)]">Permisos</legend><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-soft)] p-3">{definitions.map((definition) => <div key={definition.id} className="flex items-start gap-2"><Checkbox id={`definition-${definition.id}`} checked={selectedPermissionCodeSet.has(definition.code)} onCheckedChange={(checked) => setPermissionCodes((current) => checked === true ? [...current, definition.code] : current.filter((code) => code !== definition.code))} /><Label htmlFor={`definition-${definition.id}`} className="cursor-pointer text-sm"><span className="block font-medium">{definition.description}</span><span className="block text-xs text-[var(--text-muted)]">{definition.code}</span></Label></div>)}</div></fieldset></>}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || (kind === "profile" && permissionCodes.length === 0)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter></form></DialogContent></Dialog>;
}

function LoadingState() { return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-accent" /><p className="text-sm text-[var(--text-muted)]">Cargando la organización…</p></div>; }
function RestrictedOrganizationState({ message }: { message: string }) { return <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p></div>; }
