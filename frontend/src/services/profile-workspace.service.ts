import { OrganizationService } from "@/services/organization.service";
import { UserService } from "@/services/user.service";
import { LocationService, type Location } from "@/services/location.service";
import { InvoiceService } from "@/services/invoice.service";
import { TaskService } from "@/services/task.service";
import { CompanyService } from "@/services/company.service";
import { optionalSource } from "@/lib/optional-source";
import { isInternalProfile, profileActivityAccess } from "@/lib/profile-workspace-access";
import type { User, UserStatsResponse, WorkSession, TaskItem } from "@/types/user";
import type { Invoice } from "@/types/invoice";
import type { CompanyExpense } from "@/types/company";

export const ProfileWorkspaceService = {
    async read(user: User) {
        const internal = isInternalProfile(user);
        const permissions = await optionalSource(internal, () => OrganizationService.getAccess(), {} as Record<string, boolean>);
        const access = profileActivityAccess(permissions.value);
        const [stats, sessions, tasks, locations, invoices, companyTasks, expenses, company] = await Promise.all([
            optionalSource(internal, () => UserService.getUserStats(user.id), null as UserStatsResponse | null),
            optionalSource(internal && access.sessions, () => UserService.getUserWorkSessions(10), [] as WorkSession[]),
            optionalSource(internal && access.tasks, () => UserService.getUserTasks(user.id, 100), [] as TaskItem[]),
            optionalSource(internal && access.locations, () => LocationService.getLocations(), [] as Location[]),
            optionalSource(internal && access.finance, () => InvoiceService.getAllInvoices(), [] as Invoice[]),
            optionalSource(internal && access.tasks && permissions.value["work.manage"] === true, () => TaskService.getAllTaskItems(), [] as TaskItem[]),
            optionalSource(internal && access.finance, () => CompanyService.getCompanyExpenses(user.company_id!), [] as CompanyExpense[]),
            optionalSource(internal, async () => (await CompanyService.getCompany(user.company_id!)).name, ""),
        ]);
        return { stats: stats.value, sessions: sessions.value, tasks: tasks.value, locations: locations.value,
            invoices: invoices.value, companyTasks: companyTasks.value, expenses: expenses.value, companyName: company.value,
            access: { sessions: sessions.available, tasks: tasks.available, team: internal && access.team },
            warning: [permissions, stats, sessions, tasks, locations, invoices, companyTasks, expenses, company].some(source => source.failed)
                ? "Parte de tu actividad no está disponible para este acceso o no ha podido cargarse. Puedes seguir gestionando tus datos personales y reintentar la consulta." : "" };
    },
};
