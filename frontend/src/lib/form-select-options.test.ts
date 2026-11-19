import { createElement, Fragment } from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { formSelectOptions } from "./form-select-options.ts";

test("legacy option adapter preserves numeric and empty values and nested readable labels", () => {
    const children = [createElement("option", { value: "" }, "Todos"), createElement(Fragment, {}, createElement("option", { value: 12 }, "María ", createElement("span", {}, "López")))];
    const result = formSelectOptions(children);
    assert.deepEqual(result.map(item => [item.value, item.label]), [["", "Todos"], ["12", "María López"]]);
});
test("group permissions and descriptions are retained without rendering option elements", () => {
    const result = formSelectOptions(createElement("optgroup", { label: "Archivados", disabled: true }, createElement("option", { value: "2" }, "Centro Norte")));
    assert.deepEqual(result, [{ value: "2", label: "Centro Norte", description: "Archivados", disabled: true }]);
    assert.equal(formSelectOptions(createElement("option", {}, "Sin atributo"))[0].value, "Sin atributo");
});
