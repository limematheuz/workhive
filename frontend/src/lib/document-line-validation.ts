export type DocumentLineValidationError =
    | "empty"
    | "description"
    | "quantity"
    | "unit-price";

interface DocumentLine {
    description: string;
    quantity: number;
    unitPrice: number;
}

export function validateDocumentLines(
    lines: readonly DocumentLine[],
): DocumentLineValidationError | null {
    if (lines.length === 0) return "empty";
    if (lines.some((line) => !line.description.trim())) return "description";
    if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
        return "quantity";
    }
    if (lines.some((line) => !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
        return "unit-price";
    }
    return null;
}
