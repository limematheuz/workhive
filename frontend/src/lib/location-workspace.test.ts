import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location workspace has optional profiles, spaces, and a catalog in one API service", () => {
    const types = read("../types/location.ts");
    const service = read("../services/location.service.ts");

    assert.match(types, /LocationProfile/);
    assert.match(types, /LocationSpace/);
    assert.match(types, /profile\?: LocationProfile/);
    assert.match(service, /getLocationCatalog/);
    assert.match(service, /getSpaceSuggestions/);
    assert.match(service, /getSpaces/);
    assert.match(service, /previewBulkImport/);
    assert.match(service, /importBulkLocations/);
});

test("the new location wizard follows the four-step workflow and keeps suggestions optional", () => {
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const infoStep = read("../components/locations/LocationInfoAccessStep.tsx");
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
});

test("bulk import previews the CSV before it commits any locations", () => {
    const dialog = read("../components/locations/LocationBulkImportDialog.tsx");

    assert.match(dialog, /Descargar plantilla/);
    assert.match(dialog, /previewBulkImport/);
    assert.match(dialog, /importBulkLocations/);
    assert.match(dialog, /Vista previa/);
});

test("location configuration exposes spaces and their reusable tasks without replacing legacy services", () => {
    const tab = read("../components/locations/LocationSpacesTab.tsx");
    const sheet = read("../components/locations/LocationTasksSheet.tsx");

    assert.match(tab, /Espacios de trabajo/);
    assert.match(tab, /Tareas sugeridas/);
    assert.match(tab, /LocationService/);
    assert.match(sheet, /Espacios/);
    assert.match(sheet, /LocationSpacesTab/);
});
