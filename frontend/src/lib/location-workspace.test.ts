import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location workspace has optional profiles, spaces, and a catalog in one API service", () => {
    const types = read("../types/location.ts");
    const service = read("../services/location.service.ts");
    const workspaceService = read("../services/location-workspace.service.ts");

    assert.match(types, /LocationProfile/);
    assert.match(types, /LocationSpace/);
    assert.match(types, /profile\?: LocationProfile/);
    assert.match(service, /LocationWorkspaceService/);
    assert.match(workspaceService, /getLocationCatalog/);
    assert.match(workspaceService, /getSpaceSuggestions/);
    assert.match(workspaceService, /getSpaces/);
    assert.match(workspaceService, /reorderSpaces/);
    assert.match(workspaceService, /previewBulkImport/);
    assert.match(workspaceService, /importBulkLocations/);
});

test("the new location wizard follows the four-step workflow and keeps suggestions optional", () => {
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const infoStep = read("../components/locations/LocationInfoAccessStep.tsx");
    const types = read("../types/location.ts");
    const typeStep = read("../components/locations/LocationTypeStep.tsx");
    const featuresStep = read("../components/locations/LocationFeaturesStep.tsx");
    const spacesStep = read("../components/locations/LocationSpacesStep.tsx");

    assert.match(infoStep, /Información y acceso/);
    assert.match(typeStep, /Tipo de ubicación/);
    assert.match(featuresStep, /Características/);
    assert.match(spacesStep, /Espacios y tareas/);
    assert.match(spacesStep, /Sugerir espacios/);
    assert.match(form, /profile/);
    assert.match(form, /spaces/);
    assert.match(form, /flex h-full min-h-0 flex-col/);
    assert.match(form, /shrink-0 items-center justify-between/);
    assert.doesNotMatch(form, /sticky bottom-0/);
    assert.doesNotMatch(infoStep, /MapPin/);
    assert.match(infoStep, /items-center gap-3/);
    assert.match(infoStep, /outside-hours-authorization/);
    assert.match(types, /department_id\?: number \| null/);
    assert.match(types, /team_id\?: number \| null/);
    assert.match(form, /OrganizationService\.getDepartments/);
    assert.match(form, /OrganizationService\.getTeams/);
    assert.match(form, /department_id: departmentId/);
    assert.match(form, /team_id: teamId/);
    assert.match(infoStep, /Organización operativa/);
    assert.match(infoStep, /Un equipo asignado determina su departamento/);
    assert.match(infoStep, /<SelectTrigger id="location-workspace-department">/);
    assert.match(infoStep, /<SelectTrigger id="location-workspace-team">/);
    assert.doesNotMatch(featuresStep, /Phone/);
    assert.doesNotMatch(featuresStep, /className="pl-9"/);
});

test("bulk import previews the CSV before it commits any locations", () => {
    const dialog = read("../components/locations/LocationBulkImportDialog.tsx");

    assert.match(dialog, /Descargar plantilla/);
    assert.match(dialog, /previewBulkImport/);
    assert.match(dialog, /importBulkLocations/);
    assert.match(dialog, /Vista previa/);
    assert.match(dialog, /fileInputRef/);
    assert.match(dialog, /variant="default" size="sm"/);
    assert.match(dialog, /variant="dangerSoft"/);
});

test("locations use the shared data table and show operational detail without a photo", () => {
    const list = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");

    assert.match(list, /DataListTable/);
    assert.doesNotMatch(list, /LocationCard/);
    assert.match(list, /onRowClick=\{\(location\) => setSelectedLocationId\(location.id\)\}/);
    assert.doesNotMatch(detail, /photo_url|<Image/);
    assert.match(detail, /LocationTasksWorkspace/);
    assert.match(list, /triggerLabel/);
    assert.doesNotMatch(list, /MoreHorizontal/);
    assert.doesNotMatch(list, /onTasks:/);
});

test("location configuration exposes spaces and their reusable tasks without replacing legacy services", () => {
    const tab = read("../components/locations/LocationSpacesTab.tsx");
    const workspace = read("../components/locations/LocationTasksWorkspace.tsx");

    assert.match(tab, /Espacios y tareas/);
    assert.match(tab, /Tareas sugeridas/);
    assert.match(tab, /LocationService/);
    assert.match(tab, /GripVertical/);
    assert.match(tab, /onDragStart/);
    assert.match(tab, /reorderSpaces/);
    assert.match(workspace, /Servicios/);
    assert.match(workspace, /Espacios/);
    assert.match(workspace, /Registro/);
    assert.match(workspace, /LocationSpacesTab/);
});

test("location operational data does not reload when polling replaces the location object", () => {
    const hook = read("../hooks/useLocationTasksSheet.ts");
    const detail = read("../components/locations/LocationDetailDialog.tsx");

    assert.match(hook, /const locationId = location\?\.id/);
    assert.match(hook, /\[open, locationId\]/);
    assert.doesNotMatch(hook, /\[open, location\]/);
    assert.match(detail, /showSpaces=\{false\}/);
    assert.match(detail, /Estructura de espacios/);
});

test("opening a location shows its detail first and keeps editing as an explicit action", () => {
    const grid = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const editSheet = read("../components/locations/EditLocationSheet.tsx");

    assert.match(grid, /onRowClick=\{\(location\) => setSelectedLocationId\(location.id\)\}/);
    assert.doesNotMatch(grid, /Ver detalle/);
    assert.match(grid, /workspace\.view_location/);
    assert.match(detail, /onEdit/);
    assert.match(editSheet, /PremiumTabs/);
    assert.match(editSheet, /Espacios y tareas/);
    assert.match(editSheet, /LocationSpacesTab/);
});
