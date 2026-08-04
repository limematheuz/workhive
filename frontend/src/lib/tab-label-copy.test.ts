import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("tasks tabs use short plain labels in both dictionaries", () => {
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));

    assert.equal(es.tasks.tab_kanban, "Tablero");
    assert.equal(es.tasks.tab_list, "Lista");
    assert.equal(es.tasks.tab_templates, "Plantillas");
    assert.equal(en.tasks.tab_kanban, "Board");
    assert.equal(en.tasks.tab_list, "List");
    assert.equal(en.tasks.tab_templates, "Templates");
});

test("resumen week tab shortens on mobile only", () => {
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));
    const dashboard = read("../components/dashboard/TechDashboard.tsx");

    assert.equal(es.tech.tab_week, "Esta Semana");
    assert.equal(es.tech.tab_week_short, "Semana");
    assert.equal(en.tech.tab_week, "This Week");
    assert.equal(en.tech.tab_week_short, "Week");
    assert.match(dashboard, /hidden sm:inline.*tab_week/s);
    assert.match(dashboard, /sm:hidden.*tab_week_short/s);
});
