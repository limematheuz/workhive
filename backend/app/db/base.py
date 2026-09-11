# Import all models so Alembic registers their metadata before generating migrations.
# ruff: noqa: F401
from app.db.session import Base
from app.models.user import User
from app.models.client import Client
from app.models.client_contact import ClientContact, ClientContactRole
from app.models.client_opportunity import ClientOpportunity, ClientOpportunityActivity
from app.models.client_account_assignment import ClientAccountAssignment
from app.models.location import Location
from app.models.location_contact import LocationContact
from app.models.location_document import LocationDocument
from app.models.location_equipment import LocationEquipment
from app.models.location_risk import LocationRisk
from app.models.location_service_window import LocationServiceWindow
from app.models.location_zone import LocationZone, TaskZone, LocationSpaceTaskTemplate
from app.models.location_profile import LocationProfile
from app.models.location_access_profile import LocationAccessProfile
from app.models.role import Role
from app.models.company import Company
from app.models.company_purchase_intent import CompanyPurchaseIntent
from app.models.template_task import TemplateTask
from app.models.service_catalog_version import ServiceCatalogVersion
from app.models.location_template import LocationTemplate
from app.models.work_session import WorkSession
from app.models.work_session_pause import WorkSessionPause
from app.models.work_session_correction import WorkSessionCorrection
from app.models.labor_cost_rate import LaborCostRate
from app.models.quality_template import QualityInspectionTemplate, QualityInspectionTemplateItem
from app.models.task_item import TaskItem
from app.models.work_order import WorkOrder
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.quote import Quote
from app.models.quote_item import QuoteItem
from app.models.quote_revision import QuoteRevision
from app.models.service_contract import (
    ServiceContract,
    ServiceContractLine,
    ServiceContractLocation,
    ServiceContractLocationZone,
)
from app.models.expense import Expense
from app.models.sales_ledger_record import SalesLedgerRecord
from app.models.location_company_access import LocationCompanyAccess
from app.models.reservation import Reservation
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.invoice_email_contact import InvoiceEmailContact
from app.models.audit_log import AuditLog
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.calendar_governance import (
    CalendarOwnershipRequest,
    CompanyCalendarSettings,
    PlatformCalendarConfig,
)
from app.models.task_calendar_event import TaskCalendarEvent
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.privacy_consent import PrivacyConsent
from app.models.data_subject_request import DataSubjectRequest
from app.models.trial_request import TrialRequest
from app.models.consumed_security_token import ConsumedSecurityToken
from app.models.user_invitation import UserInvitation
from app.models.notification import Notification
from app.models.task_report import TaskReport
from app.models.company_membership import (
    CompanyMembership,
    Department,
    DepartmentMembership,
    Team,
    TeamMembership,
)
from app.models.external_access_grant import ExternalAccessGrant
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.sponsored_partner_invitation import SponsoredPartnerInvitation
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    EntitlementChangeAudit,
    PlanCatalogAudit,
    PlanEntitlement,
    SubscriptionPlan,
)
