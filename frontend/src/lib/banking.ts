const SWIFT_BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

export function normalizeSwiftBicInput(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
}

export function isValidSwiftBic(value: string): boolean {
    return SWIFT_BIC_PATTERN.test(value);
}
