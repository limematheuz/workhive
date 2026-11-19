import { operationForecast } from "@/domain/tasks/operation-priorities";
import type { TaskItem } from "@/types/user";
import { Button } from "@/components/ui/button";

export function OverviewForecast({ tasks, now, locale, onDay }: { tasks: TaskItem[]; now: Date; locale: string; onDay: (date: Date, tasks: TaskItem[]) => void }) {
    const days = operationForecast(tasks, now);
    const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", { weekday: "short", day: "numeric" });
    return <section className="wh-overview-panel p-4" aria-labelledby="overview-forecast-title"><header className="mb-3"><h2 id="overview-forecast-title" className="font-semibold">{locale === "en" ? "Next 7 days" : "Próximos 7 días"}</h2><p className="mt-1 text-xs text-muted-foreground">{locale === "en" ? "Scheduled services. Select a day to see its jobs." : "Servicios programados. Pulsa un día para ver sus trabajos."}</p></header><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{days.map(day => <Button key={day.date.toISOString()} variant="outline" onClick={() => onDay(day.date, day.tasks)} className="h-auto min-w-0 flex-col items-start gap-2 rounded-xl p-3 text-left"><span className="text-xs capitalize text-muted-foreground">{formatter.format(day.date)}</span><strong>{day.tasks.length} {locale === "en" ? day.tasks.length === 1 ? "service" : "services" : day.tasks.length === 1 ? "servicio" : "servicios"}</strong></Button>)}</div></section>;
}
