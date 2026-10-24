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

test("the location workspace uses shadcn tabs as four visible steps and keeps suggestions optional", () => {
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
    assert.match(spacesStep, /from "@\/components\/ui\/select"/);
    assert.match(spacesStep, /<SelectTrigger aria-label="Tipo de espacio">/);
    assert.doesNotMatch(spacesStep, /<select/);
    assert.match(form, /WORKSPACE_STEPS/);
    assert.match(form, /TabsList/);
    assert.match(form, /TabsTrigger/);
    assert.match(form, /Operación/);
    assert.match(form, /Contactos, riesgos y horario/);
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
    assert.match(infoStep, /from "@\/components\/ui\/button"/);
    assert.match(typeStep, /from "@\/components\/ui\/button"/);
    assert.match(typeStep, /aria-pressed=\{selected\}/);
    assert.doesNotMatch(infoStep, /<button\b/);
    assert.doesNotMatch(typeStep, /<button\b/);
    assert.doesNotMatch(featuresStep, /Phone/);
    assert.doesNotMatch(featuresStep, /className="pl-9"/);
});

test("location room and catalog actions reuse the shared button primitive", () => {
    const rooms = read("../components/locations/LocationFormRoomsSection.tsx");
    const templates = read("../components/locations/LocationTemplatesTab.tsx");

    for (const source of [rooms, templates]) {
        assert.match(source, /from "@\/components\/ui\/button"/);
        assert.doesNotMatch(source, /<button\b/);
    }
    assert.match(rooms, /variant="dangerSoft"/);
    assert.match(templates, /variant="dangerSoft"/);
});

test("location contacts are operational, scoped to the site, and separate from account contacts", () => {
    const types = read("../types/location.ts");
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const featuresStep = read("../components/locations/LocationFeaturesStep.tsx");

    assert.match(types, /LocationContactRole/);
    assert.match(types, /contacts\?: LocationContact\[\]/);
    assert.match(form, /initialContacts/);
    assert.match(form, /contacts: contacts\.map/);
    assert.match(featuresStep, /Contactos operativos/);
    assert.match(featuresStep, /No sustituyen los contactos comerciales o de facturación de la cuenta/);
    assert.match(featuresStep, /Acceso/);
    assert.match(featuresStep, /Emergencias/);
    assert.doesNotMatch(featuresStep, /contact_name/);
});

test("location risks stay attached to the site with severity and mitigation guidance", () => {
    const types = read("../types/location.ts");
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const featuresStep = read("../components/locations/LocationFeaturesStep.tsx");
    const risksSection = read("../components/locations/LocationRisksSection.tsx");

    assert.match(types, /LocationRiskSeverity/);
    assert.match(types, /risks\?: LocationRisk\[\]/);
    assert.match(form, /initialRisks/);
    assert.match(form, /risks: risks\.map/);
    assert.match(featuresStep, /LocationRisksSection/);
    assert.match(risksSection, /Riesgos operativos/);
    assert.match(risksSection, /Medida preventiva o corrección/);
    assert.match(risksSection, /Crítico/);
    assert.match(risksSection, /Mitigado/);
});

test("service schedules are distinct from access and support multiple weekday windows", () => {
    const types = read("../types/location.ts");
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const featuresStep = read("../components/locations/LocationFeaturesStep.tsx");
    const windowsSection = read("../components/locations/LocationServiceWindowsSection.tsx");

    assert.match(types, /LocationServiceWindow/);
    assert.match(types, /service_windows\?: LocationServiceWindow\[\]/);
    assert.match(form, /initialServiceWindows/);
    assert.match(form, /service_windows: serviceWindows\.map/);
    assert.match(featuresStep, /LocationServiceWindowsSection/);
    assert.match(windowsSection, /Horarios de servicio/);
    assert.match(windowsSection, /distinto del horario y las credenciales de acceso/);
    assert.match(windowsSection, /No hay horarios de servicio registrados/);
});

test("bulk import previews the CSV before it commits any locations", () => {
    const dialog = read("../components/locations/LocationBulkImportDialog.tsx");

    assert.match(dialog, /Descargar plantilla/);
    assert.match(dialog, /previewBulkImport/);
    assert.match(dialog, /importBulkLocations/);
    assert.match(dialog, /Vista previa/);
    assert.match(dialog, /fileInputRef/);
    assert.match(dialog, /variant="default" size="sm"/);
    assert.match(dialog, /variant="cancel"/);
});

test("locations use the shared data table and show operational detail without a photo", () => {
    const list = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const overview = read("../components/locations/LocationDetailOverview.tsx");

    assert.match(list, /DataListTable/);
    assert.doesNotMatch(list, /LocationCard/);
    assert.match(list, /onRowClick=\{\(location\) => setSelectedLocationId\(location.id\)\}/);
    assert.doesNotMatch(detail, /photo_url|<Image/);
    assert.match(detail, /LocationTasksWorkspace/);
    assert.match(overview, /Operación y planificación/);
    assert.match(overview, /Sin contactos operativos/);
    assert.match(overview, /Sin riesgos pendientes/);
    assert.match(overview, /Sin horarios de servicio/);
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

test("location task assignment loads people only with the directory-read capability", () => {
    const hook = read("../hooks/useLocationTasksSheet.ts");

    assert.match(hook, /OrganizationService\.getAccess\(\)/);
    assert.match(hook, /access\["access\.members\.read"\]/);
    assert.match(hook, /if \(access\["access\.members\.read"\]\) \{/);
});

test("opening a location shows its detail first and keeps editing as an explicit action", () => {
    const grid = read("../components/locations/LocationsGrid.tsx");
    const detail = read("../components/locations/LocationDetailDialog.tsx");
    const editSheet = read("../components/locations/EditLocationSheet.tsx");

    assert.match(grid, /onRowClick=\{\(location\) => setSelectedLocationId\(location.id\)\}/);
    assert.doesNotMatch(grid, /Ver detalle/);
    assert.match(grid, /workspace\.view_location/);
    assert.match(grid, /setSelectedLocationId\(null\); onEdit\(selectedLocation\)/);
    assert.match(detail, /onEdit/);
    assert.doesNotMatch(editSheet, /PremiumTabs/);
    assert.doesNotMatch(editSheet, /LocationSpacesTab/);
    assert.match(editSheet, /Empieza por los datos básicos o revisa cualquier paso/);
});

test("the locations catalog preserves the API error details for the user", () => {
    const service = read("../services/location.service.ts");

    assert.match(service, /assertApiResponseOk/);
    assert.match(service, /No se pudieron cargar las ubicaciones/);
    assert.doesNotMatch(service, /throw new Error\("Error fetching locations"\)/);
});
