import type { Locale } from "@/lib/dictionary-context";

const OVERLAP_DETAIL = "This reservation overlaps another active reservation at the location";
const INVALID_DATE_RANGE_DETAIL =
    "La fecha de salida (check-out) debe ser posterior a la fecha de entrada (check-in).";

export function reservationSaveErrorMessage(
    error: unknown,
    locale: Locale,
    fallback: string,
): string {
    if (!(error instanceof Error)) return fallback;
    if (error.message.endsWith(INVALID_DATE_RANGE_DETAIL)) {
        return locale === "es"
            ? "La salida debe ser posterior a la entrada. Corrige las fechas o las horas."
            : "Check-out must be after check-in. Adjust the dates or times.";
    }
    if (error.message !== OVERLAP_DETAIL) return error.message;

    return locale === "es"
        ? "Las fechas coinciden con otra reserva activa de esta ubicación. Revisa la entrada y la salida."
        : "These dates overlap another active reservation at this location. Review check-in and check-out.";
}
