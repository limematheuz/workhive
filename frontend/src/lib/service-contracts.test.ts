import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

test("contracts are a finance-gated agreement workspace, not a task shortcut", () => {
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx")
    const page = source("../app/dashboard/contracts/page.tsx")
    const detail = source("../components/contracts/ServiceContractDetailDialog.tsx")
    const service = source("../services/service-contract.service.ts")

    assert.match(sidebar, /href: "\/dashboard\/contracts"/)
    assert.match(page, /const canViewContracts = canViewFinance\(user\) && !isPlatformSuperadmin\(user\)/)
    assert.match(page, /Activarlos nunca crea trabajos automáticamente/)
    assert.match(detail, /Ubicaciones cubiertas/)
    assert.match(detail, /Elige zonas concretas o deja la selección vacía para cubrir toda la ubicación/)
    assert.match(detail, /Condiciones de servicio/)
    assert.match(detail, /SLA, vigencia y renovación/)
    assert.match(service, /\/api\/v1\/service-contracts\//)
    assert.match(service, /getLocationCandidates/)
    assert.match(service, /updateLocationZones/)
})
