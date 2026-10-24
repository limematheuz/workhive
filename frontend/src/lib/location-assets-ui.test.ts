import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const assetsPage = readFileSync(
    new URL("../app/dashboard/assets/page.tsx", import.meta.url),
    "utf8",
);

test("asset actions are limited to locations the current user can manage", () => {
    assert.match(
        assetsPage,
        /setLocations\(nextLocations\.filter\(\(location\) => location\.can_manage_location\)\)/,
    );
    assert.match(
        assetsPage,
        /const canManageAsset = \(asset: LocationEquipmentLibraryItem\) =>\s*manageableLocationIds\.has\(asset\.location_id\)/,
    );
    assert.match(assetsPage, /toolbar=\{locations\.length > 0 \?/);
    assert.match(assetsPage, /canManageAsset\(asset\) \? <Button key="actions"/);
    assert.match(assetsPage, /\{canManageAsset\(asset\) && <Button/);
});
