import assert from "node:assert/strict";
import test from "node:test";

import { isValidSwiftBic, normalizeSwiftBicInput } from "./banking.ts";

test("SWIFT/BIC input is normalized without accepting punctuation", () => {
    assert.equal(normalizeSwiftBicInput(" caixes-bb xxx "), "CAIXESBBXXX");
    assert.equal(normalizeSwiftBicInput("deutdeff500-extra"), "DEUTDEFF500");
});

test("SWIFT/BIC validation accepts only ISO 9362 8 or 11 character codes", () => {
    assert.equal(isValidSwiftBic("CAIXESBB"), true);
    assert.equal(isValidSwiftBic("CAIXESBBXXX"), true);
    assert.equal(isValidSwiftBic("12345678"), false);
    assert.equal(isValidSwiftBic("CAIXESBBXX!"), false);
});
