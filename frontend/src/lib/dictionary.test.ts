import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const spanish = JSON.parse(
    readFileSync(new URL("../dictionaries/es.json", import.meta.url), "utf8"),
);

test("Spanish task and checkout controls do not fall back to English", () => {
    assert.equal(
        spanish.tech.checkout_checklist_desc,
        "Tareas obligatorias antes de que el trabajador finalice la jornada en esta ubicación.",
    );
    assert.equal(
        spanish.tech.checkout_checklist_placeholder,
        "Ej.: Verificar que la alarma está activada",
    );
    assert.equal(spanish.tasks.create_dialog.btn_add, "Añadir");
    assert.equal(spanish.locations.form.checkout_checklist_empty, "No hay tareas de salida configuradas.");
    assert.equal(spanish.tasks.create_dialog.link_default_task, "Vincular tarea fija");
});
