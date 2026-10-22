import type { Locale } from "@/lib/dictionary-context";

const OVERLAP_DETAIL = "This reservation overlaps another active reservation at the location";

export function reservationSaveErrorMessage(
    error: unknown,
    locale: Locale,
    fallback: string,
): string {
    if (!(error instanceof Error)) return fallback;
    if (error.message !== OVERLAP_DETAIL) return error.message;

    return locale === "es"
        ? "Las fechas coinciden con otra reserva activa de esta ubicación. Revisa la entrada y la salida."
        : "These dates overlap another active reservation at this location. Review check-in and check-out.";
}
