from collections import Counter
from datetime import datetime,date,timezone
from decimal import Decimal
from itertools import groupby
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.repositories import management_insights as repo,service_hours as hours_repo,customer_payment as payment_repo
from app.services.organization_authorization_service import require_capability,has_capability,permitted_location_ids
from app.services.user_scope import require_company_context
from app.services.client_profitability_service import get_client_profitability
from app.services.company_preferences_service import preferences
from app.services.labor_cost_snapshot_service import _worked_seconds
from app.services.service_hours_service import session_summary
from app.services.estimator_cost_policy import money,ZERO


def utc(value):return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def period_dates(month,period,company_zone):
    try:
        reference=datetime.strptime(month,"%Y-%m").date() if month else datetime.now(ZoneInfo(company_zone)).date().replace(day=1)
        if month and reference.strftime("%Y-%m")!=month:raise ValueError()
        if not 2000<=reference.year<=9998:raise ValueError()
        start=datetime(reference.year,1 if period=="year" else reference.month,1,tzinfo=timezone.utc)
        end=start.replace(year=start.year+1) if period=="year" else start.replace(year=start.year+(start.month==12),month=start.month%12+1)
    except (ValueError,OverflowError):raise HTTPException(422,"Selecciona un periodo válido.")
    return reference,start,end


def time_totals(db,user,company,start,end):
    allowed=permitted_location_ids(db,user,"time.read")
    seconds=0;labor=ZERO;missing=0;count=0
    for session in repo.sessions(db,company,start,end,allowed):
        seconds+=_worked_seconds(session);count+=1
        if session.labor_cost_amount_snapshot is None or session.labor_cost_company_id!=company:missing+=1
        else:labor+=Decimal(str(session.labor_cost_amount_snapshot))
    approved=0
    for _,rows in groupby(hours_repo.approved_entries(db,hours_repo.tasks(db,company,allowed),start,end),key=lambda entry:entry[0].task_item_id):
        entries=list(rows)
        if entries[0][1].session_signature!=session_summary([entry[0] for entry in entries])[1]:continue
        approved+=sum(_worked_seconds(session) for session,_,_ in entries if session.end_time and start<=utc(session.end_time)<end)
    return dict(closed_person_hours=money(Decimal(seconds)/3600),approved_person_hours=money(Decimal(approved)/3600),closed_sessions=count,
        recorded_labor_cost=money(labor),sessions_without_labor_cost=missing,completed_jobs_without_hours=repo.completed_without_hours(db,company,start,end,allowed),staff_assignments_without_hours=repo.staff_without_hours(db,company,start,end,allowed))


def domain_scope(db,user,permission):
    try:return True,permitted_location_ids(db,user,permission)
    except HTTPException as error:
        if error.status_code in {403,404}:return False,None
        raise


def read(db,user,month=None,period="month"):
    company=require_company_context(user)
    require_capability(db,user,"finance.read");require_capability(db,user,"labor_costs.read")
    reference,start,end=period_dates(month,period,preferences(db,company)["timezone"])
    profit=get_client_profitability(db,company,period=period,reference_date=reference)
    from app.repositories.transaction_currency import exchange_difference
    current=profit.current;previous=profit.previous
    revenue=money(current.revenue_base_amount+current.unlinked_historical_sales_base_amount)
    costs=money(current.direct_cost_base_amount+current.unassigned_expense_base_amount+current.unassigned_material_cost_base_amount)
    prior=money(previous.revenue_base_amount+previous.unlinked_historical_sales_base_amount)
    payments=Decimal(str(repo.received(db,company,start,end)))
    invoices=repo.open_invoices(db,company);allocated=payment_repo.allocated_amounts_for_invoices(db,company_id=company,invoice_ids=[invoice.id for invoice in invoices])
    outstanding=money(sum((max(ZERO,Decimal(str(invoice.total_amount))-allocated.get(invoice.id,ZERO)) for invoice in invoices),ZERO))
    result=dict(period=period,month=reference.strftime("%Y-%m"),timezone="UTC",starts_at=start,ends_at=end,as_of=datetime.now(timezone.utc),
        finance=dict(revenue_base=revenue,registered_expense_and_material_cost=costs,recorded_balance=money(revenue-costs),previous_revenue_base=prior,
            revenue_change_percent=money((revenue-prior)/prior*100) if prior else None,received_with_tax=money(payments),outstanding_with_tax=outstanding,
            realized_exchange_difference=money(Decimal(str(exchange_difference(db,company,start,end)))),unpaid_invoice_count=len(invoices),unknown_material_consumptions=repo.unknown_materials(db,company,start,end),
            clients=[row.model_dump() for row in sorted(current.clients,key=lambda row:row.revenue_base_amount,reverse=True)[:8]]),
        operations=None,time=None,quality=None,pipeline=None)
    work_allowed,allowed=domain_scope(db,user,"work.read")
    if work_allowed:
        states=Counter();locations=set();jobs=0
        for task in repo.tasks(db,company,start,end,allowed):
            if task.status=="rejected":continue
            states[task.status]+=1;locations.add(task.location_id);jobs+=1
        planned_minutes=0;people=set()
        for shift in repo.shifts(db,company,start,end,allowed):
            planned_minutes+=max(0,(min(utc(shift.ends_at),end)-max(utc(shift.starts_at),start)).total_seconds()/60);people.add(shift.employee_id)
        result["operations"]=dict(scheduled_jobs=jobs,current_statuses=dict(states),unique_locations=len(locations),scheduled_people=len(people),planned_person_hours=money(Decimal(str(planned_minutes))/60),completed_unbilled=repo.unbilled_count(db,company,allowed))
    time_allowed,_=domain_scope(db,user,"time.read")
    if time_allowed:result["time"]=time_totals(db,user,company,start,end)
    quality_allowed,quality_locations=domain_scope(db,user,"quality.incidents.read")
    if quality_allowed:
        result["quality"]=dict(open_incidents=repo.open_incidents(db,company,quality_locations))
    if has_capability(db,user,"commercial.follow_ups.read"):result["pipeline"]={stage:count for stage,count in repo.pipeline(db,company)}
    return result
