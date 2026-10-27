export const toDateTimeInput = (value = new Date()) => {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
};

export const workOrderStatusCopy = {
    draft: "Borrador", active: "Activa", paused: "Pausada", completed: "Finalizada", cancelled: "Cancelada",
} as const;
