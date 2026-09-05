/** Render an API timestamp in a datetime-local field without shifting its instant. */
export function toDateTimeLocal(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const part = (number: number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
