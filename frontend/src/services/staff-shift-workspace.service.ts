import { LocationService, type Location } from "@/services/location.service";
import { OrganizationService } from "@/services/organization.service";
import { StaffService, type Employee } from "@/services/staff.service";
import { readStaffShifts, type StaffShift } from "@/services/staff-shift.service";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";
import { optionalSource } from "@/lib/optional-source";

export async function readStaffShiftWorkspace() {
    const permissions = await OrganizationService.getAccess();
    const canRead = permissions["work.read"] === true && permissions["labor_costs.read"] === true;
    const [rows, people, sites, tasks] = await Promise.all([
        canRead ? readStaffShifts() : Promise.resolve<StaffShift[]>([]),
        canRead ? StaffService.list() : Promise.resolve<Employee[]>([]),
        optionalSource(canRead && permissions["locations.read"] === true, () => LocationService.getLocations(), [] as Location[]),
        optionalSource(canRead && permissions["work.read"] === true, () => TaskService.getAllTaskItems(), [] as TaskItem[]),
    ]);
    return { rows, people, sites: sites.value, tasks: tasks.value, canRead,
        canSchedule: permissions["work.manage"] === true && permissions["labor_costs.manage"] === true,
        canChooseLocations: sites.available,
        warning: sites.failed || tasks.failed ? "No se pudieron consultar algunos nombres de ubicaciones o trabajos. Los turnos siguen disponibles; vuelve a actualizar para reintentarlo." : "" };
}
