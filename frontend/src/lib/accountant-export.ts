export const MIN_ACCOUNTANT_EXPORT_YEAR = 2000;

export function accountantExportFilename(year: number): string {
    return `workhive-gestoria-${year}.zip`;
}

export function accountantExportPath(year: number): string {
    if (!Number.isInteger(year) || year < MIN_ACCOUNTANT_EXPORT_YEAR || year > 2100) {
        throw new Error("Accountant export year is invalid");
    }
    return `/api/v1/accounting-exports/accountant?year=${year}`;
}

export function accountantExportYears(
    currentYear: number,
    count = 5,
): number[] {
    return Array.from({ length: count }, (_, index) => currentYear - index)
        .filter((year) => year >= MIN_ACCOUNTANT_EXPORT_YEAR);
}
