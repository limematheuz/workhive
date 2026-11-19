from fastapi import APIRouter
api_router = APIRouter()
from app.api.v1.worker_workspace import router as worker_workspace_router
api_router.include_router(worker_workspace_router, tags=["worker-workspace"])
from app.api.v1.worker_photos import router as worker_photos_router
api_router.include_router(worker_photos_router, tags=["worker-workspace"])

from app.api.v1.staff import router as staff_router
api_router.include_router(staff_router, tags=["staff"])

from app.api.v1.staff_absences import router as staff_absences_router
api_router.include_router(staff_absences_router, tags=["staff"])

from app.api.v1.service_hours import router as service_hours_router
api_router.include_router(service_hours_router, tags=["service-hours"])

from app.api.v1.additional_work import router as additional_work_router
api_router.include_router(additional_work_router, tags=['additional-work'])

from app.api.v1.advisory import router as advisory_router
api_router.include_router(advisory_router, tags=['advisory'])

from app.api.v1.staff_shifts import router as staff_shifts_router
api_router.include_router(staff_shifts_router, tags=['staff'])

from app.api.v1.offline_work import router as offline_work_router
api_router.include_router(offline_work_router, tags=['offline-work'])

from app.api.v1.resource_log import router as resource_log_router
api_router.include_router(resource_log_router, tags=['resources'])

from app.api.v1.staff_documentation import router as staff_documentation_router
api_router.include_router(staff_documentation_router, tags=['staff'])

from app.api.v1.consolidation import router as consolidation_router
api_router.include_router(consolidation_router, tags=['consolidation'])

from app.api.v1.internal_requests import router as internal_requests_router
api_router.include_router(internal_requests_router, tags=['internal-requests'])

from app.api.v1.data_import import router as data_import_router
api_router.include_router(data_import_router, tags=['data-import'])

from app.api.v1.operations_automation import router as operations_automation_router
api_router.include_router(operations_automation_router, tags=['operations-automation'])

from app.api.v1.staff_document_files import router as staff_document_files_router
api_router.include_router(staff_document_files_router, tags=['staff'])

from app.api.v1.quote_cost_estimates import router as quote_cost_estimates_router
api_router.include_router(quote_cost_estimates_router, tags=['quote-cost-estimates'])

from app.api.v1.material_plans import router as material_plans_router
api_router.include_router(material_plans_router,tags=["material-plans"])
from app.api.v1.subcontracts import router as subcontracts_router
api_router.include_router(subcontracts_router,tags=["subcontracts"])

from app.api.v1.saved_reports import router as saved_reports_router
api_router.include_router(saved_reports_router,tags=["custom-reports"])

from app.api.v1.advisory_requests import router as advisory_requests_router
api_router.include_router(advisory_requests_router,tags=["advisory"])

from app.api.v1.advisory_accounting import router as advisory_accounting_router
api_router.include_router(advisory_accounting_router,tags=["advisory"])

from app.api.v1.service_planning import router as service_planning_router
api_router.include_router(service_planning_router,tags=["service-planning"])

from app.api.v1.workforce_execution import router as workforce_execution_router
api_router.include_router(workforce_execution_router,tags=["workforce-execution"])

from app.api.v1.commercial_workspace import router as commercial_workspace_router
api_router.include_router(commercial_workspace_router,tags=["commercial-workspace"])
from app.api.v1.portal_workspace import router as portal_workspace_router
api_router.include_router(portal_workspace_router,tags=["portal-workspace"])

from app.api.v1.service_estimator import router as service_estimator_router
api_router.include_router(service_estimator_router,tags=["service-estimator"])

from app.api.v1.management_insights import router as management_insights_router
api_router.include_router(management_insights_router,tags=["management-insights"])

from app.api.v1.task_space_scope import router as task_space_scope_router
api_router.include_router(task_space_scope_router,tags=["workforce-execution"])

from app.api.v1.task_client_publication import router as task_client_publication_router
api_router.include_router(task_client_publication_router,tags=["client-work-publications"])

from app.api.v1.workflow_approvals import router as workflow_approvals_router
api_router.include_router(workflow_approvals_router,tags=["workflow-approvals"])

from app.api.v1 import accounting_periods
api_router.include_router(accounting_periods.router,tags=["accounting-periods"])

from app.api.v1 import transaction_currency
api_router.include_router(transaction_currency.router,tags=["transaction-currency"])

from app.api.v1.record_history import router as record_history_router
api_router.include_router(record_history_router, tags=["record-history"])
from app.api.v1.document_register import router as document_register_router
api_router.include_router(document_register_router,tags=["document-register"])
from app.api.v1.labor_communications import router as labor_communications_router
api_router.include_router(labor_communications_router,tags=["labor-communications"])
from app.api.v1.company_session import router as company_session_router
api_router.include_router(company_session_router,tags=["company-session"])
from app.api.v1.application_session import router as application_session_router
api_router.include_router(application_session_router, tags=["application-session"])

from app.api.v1.quick_work import router as quick_work_router
api_router.include_router(quick_work_router,tags=["workforce-execution"])

from app.api.v1.workspace_search import router as workspace_search_router
api_router.include_router(workspace_search_router, tags=["workspace-search"])
