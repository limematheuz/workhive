import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("invoice draft save resets the dialog's dirty guard only after the API succeeds", () => {
    const guard = read("../components/ui/dialog-form-guard.tsx");
    const dialog = read("../components/ui/dialog.tsx");
    const invoice = read("../hooks/useInvoiceDetail.ts");

    assert.match(guard, /useDialogFormGuardReset/);
    assert.match(guard, /dirty\.current\.clear\(\)/);
    assert.match(dialog, /DialogFormGuardResetProvider/);
    assert.match(invoice, /await InvoiceService\.updateInvoice\(invoice\.id, headerPayload\);\s*resetDialogDirty\(\)/);
    assert.match(guard, /if \(dirty\.current\.size === 0\) return close\(\)/);
});
