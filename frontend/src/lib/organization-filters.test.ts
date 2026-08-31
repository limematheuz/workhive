import assert from "node:assert/strict";
import test from "node:test";

import {
    filterOrganizationDepartments,
    filterOrganizationMembers,
    filterOrganizationTeams,
    filterPermissionProfiles,
} from "./organization-filters.ts";
import type {
    OrganizationDepartment,
    OrganizationMember,
    OrganizationTeam,
    PermissionProfile,
} from "@/services/organization.service";

const members: OrganizationMember[] = [
    {
        id: 1,
        user_id: 11,
        full_name: "Andrea Campo",
        email: "andrea@example.test",
        access_class: "admin",
        status: "active",
        ended_at: null,
        is_anonymized: false,
        legacy_role_name: "admin",
        department_ids: [],
        team_ids: [],
        profile_assignments: [{ id: 1, permission_profile_id: 1, permission_profile_name: "Operaciones", scopes: [] }],
    },
    {
        id: 2,
        user_id: 12,
        full_name: "Bruno Equipo",
        email: "bruno@example.test",
        access_class: "responsible",
        status: "suspended",
        ended_at: null,
        is_anonymized: false,
        legacy_role_name: "manager",
        department_ids: [],
        team_ids: [],
        profile_assignments: [],
    },
    {
        id: 3,
        user_id: 13,
        full_name: "Celia Historial",
        email: "celia@example.test",
        access_class: "worker",
        status: "archived",
        ended_at: "2026-08-30T12:00:00Z",
        is_anonymized: false,
        legacy_role_name: "viewer",
        department_ids: [],
        team_ids: [],
        profile_assignments: [],
    },
];

const departments: OrganizationDepartment[] = [
    { id: 1, name: "Operaciones", code: "OPS", parent_department_id: null, is_active: true },
    { id: 2, name: "Limpieza", code: "LIM", parent_department_id: 1, is_active: true },
    { id: 3, name: "Antiguo", code: null, parent_department_id: null, is_active: false },
];

const teams: OrganizationTeam[] = [
    { id: 1, name: "Equipo norte", code: "N", department_id: 1, is_active: true },
    { id: 2, name: "Equipo sur", code: "S", department_id: null, is_active: false },
];

const profiles: PermissionProfile[] = [
    {
        id: 1,
        name: "Administrador",
        description: "Control de empresa",
        is_system: true,
        is_active: true,
        permission_codes: ["company.settings.manage"],
        usage: { assignments: 1, can_delete: false },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    },
    {
        id: 2,
        name: "Operaciones",
        description: "Gestiona equipos",
        is_system: false,
        is_active: false,
        permission_codes: ["organization.teams.manage"],
        usage: { assignments: 0, can_delete: true },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    },
];

test("member filters search profile names and keep archived people separate from suspended access", () => {
    assert.deepEqual(
        filterOrganizationMembers(members, { search: "operaciones", accessClass: "all", status: "all" }).map(({ id }) => id),
        [1],
    );
    assert.deepEqual(
        filterOrganizationMembers(members, { search: "", accessClass: "responsible", status: "suspended" }).map(({ id }) => id),
        [2],
    );
    assert.deepEqual(
        filterOrganizationMembers(members, { search: "", accessClass: "all", status: "archived" }).map(({ id }) => id),
        [3],
    );
});

test("department filters combine text, status, and parent department", () => {
    assert.deepEqual(
        filterOrganizationDepartments(departments, { search: "lim", status: "active", parentDepartmentId: "1" }).map(({ id }) => id),
        [2],
    );
    assert.deepEqual(
        filterOrganizationDepartments(departments, { search: "", status: "inactive", parentDepartmentId: "none" }).map(({ id }) => id),
        [3],
    );
});

test("team filters combine text, status, and department", () => {
    assert.deepEqual(
        filterOrganizationTeams(teams, { search: "norte", status: "active", departmentId: "1" }).map(({ id }) => id),
        [1],
    );
    assert.deepEqual(
        filterOrganizationTeams(teams, { search: "", status: "inactive", departmentId: "none" }).map(({ id }) => id),
        [2],
    );
});

test("permission profile filters cover descriptions, permission codes, type, and status", () => {
    assert.deepEqual(
        filterPermissionProfiles(profiles, { search: "teams.manage", type: "custom", status: "inactive" }).map(({ id }) => id),
        [2],
    );
    assert.deepEqual(
        filterPermissionProfiles(profiles, { search: "empresa", type: "system", status: "active" }).map(({ id }) => id),
        [1],
    );
});
