export const QUALIFICATIONS = {
    general_cleaning: "Limpieza general", chemical_handling: "Productos químicos",
    height_work: "Trabajo en altura", industrial_cleaning: "Limpieza industrial", food_hygiene: "Higiene alimentaria",
} as const;
export type QualificationCode = keyof typeof QUALIFICATIONS;
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export type WeeklyAvailability = { weekday: number; starts_at: string; ends_at: string; _key?: string };
export const AVAILABILITY_TIMES = Array.from({ length: 48 }, (_, index) => String(Math.floor(index / 2)).padStart(2, "0") + (index % 2 ? ":30" : ":00"));
