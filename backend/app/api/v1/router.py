from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.clients import router as clients_router
from app.api.v1.locations import router as locations_router
from app.api.v1.roles import router as roles_router
from app.api.v1.companies import router as companies_router
from app.api.v1.template_tasks import router as template_tasks_router
from app.api.v1.location_templates import router as location_templates_router
from app.api.v1.work_sessions import router as work_sessions_router
from app.api.v1.task_items import router as task_items_router
from app.api.v1.invoice import router as invoices_router
from app.api.v1.fiscal_settings import router as fiscal_settings_router
from app.api.v1.invoice_email_contacts import router as invoice_email_contacts_router
from app.api.v1.quotes import router as quotes_router
from app.api.v1.expenses import router as expenses_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.reservations import router as reservations_router
from app.api.v1.location_company_access import router as location_company_access_router
from app.api.v1.collaborations import router as collaborations_router
from app.api.v1.billing import router as billing_router
from app.api.v1.contact import router as contact_router
from app.api.v1.trial_requests import router as trial_requests_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.privacy import router as privacy_router
from app.api.v1.traffic import router as traffic_router
from app.api.v1.user_invitations import router as user_invitations_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.task_reports import router as task_reports_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(
    user_invitations_router,
    prefix="/user-invitations",
    tags=["user-invitations"],
)
api_router.include_router(clients_router, prefix="/clients", tags=["clients"])
api_router.include_router(locations_router, prefix="/locations", tags=["locations"])
api_router.include_router(
    location_company_access_router, prefix="/locations", tags=["location-company-access"]
)
api_router.include_router(
    reservations_router, prefix="/reservations", tags=["reservations"]
)
api_router.include_router(roles_router, prefix="/roles", tags=["roles"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
api_router.include_router(
    template_tasks_router, prefix="/template-tasks", tags=["template-tasks"]
)
api_router.include_router(
    location_templates_router, prefix="/locations", tags=["location-templates"]
)
api_router.include_router(
    work_sessions_router, prefix="/work-sessions", tags=["work-session"]
)
api_router.include_router(task_items_router, prefix="/task-items", tags=["task-items"])
api_router.include_router(task_reports_router, prefix="/task-reports", tags=["task-reports"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(invoices_router, prefix="/invoices", tags=["invoices"])
api_router.include_router(
    invoice_email_contacts_router,
    prefix="/invoice-email-contacts",
    tags=["invoice-email-contacts"],
)
api_router.include_router(
    fiscal_settings_router,
    prefix="/fiscal-settings",
    tags=["fiscal-settings"],
)
api_router.include_router(quotes_router, prefix="/quotes", tags=["quotes"])
api_router.include_router(expenses_router, prefix="/expenses", tags=["expenses"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
api_router.include_router(collaborations_router, prefix="/collaborations", tags=["collaborations"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])
api_router.include_router(contact_router, prefix="/contact", tags=["contact"])
api_router.include_router(
    trial_requests_router,
    prefix="/trial-requests",
    tags=["trial-requests"],
)
api_router.include_router(
    audit_logs_router,
    prefix="/audit-logs",
    tags=["audit-logs"],
)
api_router.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
api_router.include_router(privacy_router, prefix="/privacy", tags=["privacy"])
api_router.include_router(traffic_router, prefix="/traffic", tags=["traffic"])
