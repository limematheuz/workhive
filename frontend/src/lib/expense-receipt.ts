export const MAX_EXPENSE_RECEIPT_BYTES = 10 * 1024 * 1024;

const RECEIPT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function isPrivateExpenseReceipt(reference: string | null | undefined): boolean {
    return Boolean(reference?.startsWith("private-expense-receipt:"));
}

export function validateExpenseReceiptFile(file: File): "empty" | "too_large" | "invalid_type" | null {
    if (file.size === 0) return "empty";
    if (file.size > MAX_EXPENSE_RECEIPT_BYTES) return "too_large";
    if (!RECEIPT_TYPES.has(file.type)) return "invalid_type";
    return null;
}

export function isExpectedReceiptRejection(error: unknown): error is Error & { status: number } {
    return error instanceof Error
        && "status" in error
        && typeof error.status === "number"
        && error.status >= 400
        && error.status < 500;
}

export function getExpenseReceiptFeedback(error: unknown, fallback: string): string {
    return isExpectedReceiptRejection(error) && error.message.trim() ? error.message : fallback;
}
