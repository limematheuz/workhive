const spanishDateFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});

function createLocalDate(year: number, month: number, day: number): Date | undefined {
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year
        || date.getMonth() !== month - 1
        || date.getDate() !== day
    ) {
        return undefined;
    }
    return date;
}

export function parseIsoDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    return createLocalDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function formatSpanishDate(value: Date | undefined): string {
    if (!value) return "";
    return spanishDateFormatter.format(value);
}

export function formatDateTyping(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseTypedDate(value: string): Date | undefined {
    const digits = value.replace(/\D/g, "");
    const match = /^(\d{2})(\d{2})(\d{4})$/.exec(digits);
    if (!match) return undefined;
    return createLocalDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

export function isDateWithinBounds(date: Date, min?: string, max?: string): boolean {
    const isoDate = toIsoDate(date);
    return (!min || isoDate >= min) && (!max || isoDate <= max);
}
