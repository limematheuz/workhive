export const TOUR_STEPS = [
    {
        selector: "#tour-welcome",
        title: "Bienvenido a tu Panel",
        content: "Aquí tienes un resumen general del estado de tu empresa de limpieza, trabajadores y tareas activas.",
        placement: "bottom" as const,
    },
    {
        selector: "#tour-stats",
        title: "Estadísticas Clave",
        content: "Visualiza rápidamente el total facturado, ubicaciones activas, tareas pendientes y cobros pendientes.",
        placement: "bottom" as const,
    },
    {
        selector: "#tour-calendar",
        title: "Calendario de Operaciones",
        content: "Gestiona y visualiza la planificación de jornadas, asignaciones de personal y tareas en tiempo real.",
        placement: "top" as const,
    },
    {
        selector: "#tour-clock",
        title: "Control de Fichajes",
        content: "Desde aquí tus trabajadores pueden fichar su entrada y salida de las ubicaciones asignadas.",
        placement: "left" as const,
    },
    {
        selector: "#tour-sidebar",
        title: "Menú de Navegación",
        content: "Accede a las secciones de Clientes, Ubicaciones, Equipo, Presupuestos y Facturas para gestionar tu negocio.",
        placement: "right" as const,
    },
];

export type TourStep = (typeof TOUR_STEPS)[number];

export type TourCoords = {
    top: number;
    left: number;
    width: number;
    height: number;
};
