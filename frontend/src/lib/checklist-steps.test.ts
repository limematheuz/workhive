import assert from "node:assert/strict";
import test from "node:test";

import {
    parseChecklistStepTexts,
    serializeChecklistSteps,
} from "./checklist-steps.ts";

test("visual checklist steps preserve legacy content without exposing markdown", () => {
    assert.deepEqual(
        parseChecklistStepTexts("- [ ] Limpiar suelo\n- [x] Revisar ventanas"),
        ["Limpiar suelo", "Revisar ventanas"],
    );
    assert.deepEqual(parseChecklistStepTexts("Instrucción antigua"), ["Instrucción antigua"]);
    assert.deepEqual(parseChecklistStepTexts(""), []);
});

test("visual checklist steps serialize only meaningful task steps", () => {
    assert.equal(
        serializeChecklistSteps([{ text: " Limpiar cocina " }, { text: "" }, { text: "Cerrar ventanas" }]),
        "- [ ] Limpiar cocina\n- [ ] Cerrar ventanas",
    );
});
