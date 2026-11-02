"""Serialize authorized report records without performing storage queries."""

from app.models.task_report import TaskReport
from app.schemas.task_report import TaskReportResponse


def serialize_task_report(report: TaskReport) -> TaskReportResponse:
    task = report.task_item
    return TaskReportResponse(
        id=report.id,
        task_item_id=report.task_item_id,
        reporter_user_id=report.reporter_user_id,
        reporter_company_id=report.reporter_company_id,
        requesting_company_id=report.requesting_company_id,
        report_type=report.report_type,
        title=report.title,
        description=report.description,
        issue_type=report.issue_type,
        element=report.element,
        file_name=report.file_name,
        checklist_item_id=report.checklist_item_id,
        checklist_item_label=report.checklist_item_label,
        reporter_name=report.reporter_name,
        reporter_company_name=report.reporter_company.name,
        requesting_company_name=(
            report.requesting_company.name if report.requesting_company else None
        ),
        task_title=task.title,
        location_name=task.location.name,
        media_url=(
            f"/api/v1/task-reports/{report.id}/media" if report.media_key else None
        ),
        created_at=report.created_at,
    )
