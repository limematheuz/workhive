from datetime import datetime,timedelta
from decimal import Decimal
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.models.staff_shift import StaffShift
from app.models.staff_employee import StaffEmployee
from app.models.staff_account import StaffAccount
from app.models.workforce_plan import TaskSpaceStaff
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.customer_payment import CustomerPayment,CustomerPaymentAllocation
from app.models.service_hours_review import ServiceHoursReview
from app.services.service_hours_service import session_summary
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers,_user
from test_service_contracts import _client,_location


def test_management_uses_recorded_finance_closed_time_and_current_missing_data(client,db):
    company=_company(db,"management");admin=_bootstrap_admin(db,company,"management");headers=_headers(admin)
    customer=_client(client,headers);site=_location(client,headers,customer["id"],spaces=[{"name":"Sala","space_type":"office","tasks":[{"title":"Mesas","estimated_minutes":30}]}])
    space=client.get(f"/api/v1/locations/{site['id']}/spaces",headers=headers).json()[0]
    start=datetime(2026,11,16,8)
    tasks=[TaskItem(title="Trabajo "+str(i),company_id=company.id,location_id=site["id"],unit="h",status="completed",scheduled_start_at=start,date_done=start+timedelta(hours=3)) for i in range(2)]
    db.add_all(tasks);db.flush()
    staff=[StaffEmployee(company_id=company.id,name="Persona "+str(i),position="Limpieza",team="",monthly_hours=160,hourly_cost=15) for i in range(2)]
    db.add_all(staff);db.flush()
    db.add(StaffAccount(company_id=company.id,employee_id=staff[0].id,user_id=admin.id))
    db.add_all([TaskSpaceStaff(company_id=company.id,task_id=tasks[i].id,space_id=space["id"],space_name="Sala",employee_id=staff[i].id) for i in range(2)])
    db.add(StaffShift(company_id=company.id,employee_id=staff[0].id,task_id=tasks[0].id,location_id=site["id"],starts_at=start,ends_at=start+timedelta(hours=2)))
    log=WorkSession(user_id=admin.id,task_item_id=tasks[0].id,location_id=site["id"],start_time=start,end_time=start+timedelta(hours=2),paused_seconds=900,labor_cost_company_id=company.id,labor_cost_rate_snapshot=15,labor_cost_amount_snapshot=Decimal("26.25"))
    outside=WorkSession(user_id=admin.id,task_item_id=tasks[0].id,location_id=site["id"],start_time=datetime(2026,12,1),end_time=datetime(2026,12,1,1),paused_seconds=0)
    db.add_all([log,outside]);db.flush()
    review=ServiceHoursReview(task_id=tasks[0].id,approved_seconds=9900,session_signature=session_summary([log,outside])[1],approved_by=admin.id,approved_at=start)
    db.add(review)
    invoice=Invoice(company_id=company.id,client_id=customer["id"],invoice_number="MAN-1",issue_date=start,status="issued",base_amount=100,tax_amount=21,total_amount=121)
    prior=Invoice(company_id=company.id,client_id=customer["id"],invoice_number="MAN-0",issue_date=datetime(2026,10,16),status="paid",base_amount=50,tax_amount=10.5,total_amount=60.5)
    draft=Invoice(company_id=company.id,client_id=customer["id"],invoice_number="MAN-DRAFT",issue_date=start,status="draft",base_amount=999,tax_amount=0,total_amount=999)
    db.add_all([invoice,prior,draft]);db.flush()
    payment=CustomerPayment(company_id=company.id,client_id=customer["id"],amount=50,received_at=start,status="received")
    db.add(payment);db.flush()
    db.add(CustomerPaymentAllocation(payment_id=payment.id,invoice_id=invoice.id,amount=50))
    db.add(Expense(company_id=company.id,client_id=customer["id"],expense_date=start,category="Labor",description="Registrado",base_amount=20,total_amount=20))
    db.add(CustomerPayment(company_id=company.id,client_id=customer["id"],amount=999,received_at=start,status="voided"))
    db.commit()
    response=client.get("/api/v1/management-insights?month=2026-11",headers=headers)
    assert response.status_code==200,response.text
    data=response.json();finance=data["finance"];time=data["time"]
    assert Decimal(finance["revenue_base"])==100 and Decimal(finance["registered_expense_and_material_cost"])==20
    assert Decimal(finance["recorded_balance"])==80
    assert Decimal(finance["received_with_tax"])==50 and Decimal(finance["outstanding_with_tax"])==71
    assert Decimal(finance["revenue_change_percent"])==100
    assert data["operations"]["scheduled_jobs"]==2 and data["operations"]["scheduled_people"]==1
    assert Decimal(time["closed_person_hours"])==Decimal("1.75") and Decimal(time["approved_person_hours"])==Decimal("1.75")
    assert Decimal(time["recorded_labor_cost"])==Decimal("26.25")
    assert time["completed_jobs_without_hours"]==1 and time["staff_assignments_without_hours"]==1
    outside.paused_seconds=60;db.commit()
    changed=client.get("/api/v1/management-insights?month=2026-11",headers=headers).json()
    assert Decimal(changed["time"]["approved_person_hours"])==0
    worker=_user(db,company,"management-denied",role_id=3);db.commit()
    assert client.get("/api/v1/management-insights?month=2026-11",headers=_headers(worker)).status_code==403
    other=_headers(_bootstrap_admin(db,_company(db,"management-other"),"management-other"))
    isolated=client.get("/api/v1/management-insights?month=2026-11",headers=other)
    assert isolated.status_code==200,isolated.text
    assert Decimal(isolated.json()["finance"]["revenue_base"])==0 and isolated.json()["operations"]["scheduled_jobs"]==0


def test_management_month_bounds_and_foreign_wage_snapshots_are_explicit(client,db):
    company=_company(db,"management-boundary");admin=_bootstrap_admin(db,company,"management-boundary");headers=_headers(admin)
    site=_location(client,headers,_client(client,headers)["id"])
    other=_company(db,"snapshot-owner");db.commit()
    task=TaskItem(company_id=company.id,location_id=site["id"],title="Fin de mes",unit="service",scheduled_start_at=datetime(2026,12,1),status="completed",date_done=datetime(2026,12,1))
    db.add(task);db.flush()
    db.add(WorkSession(user_id=admin.id,task_item_id=task.id,location_id=site["id"],start_time=datetime(2026,11,30,23),end_time=datetime(2026,12,1),paused_seconds=0,labor_cost_company_id=other.id,labor_cost_rate_snapshot=500,labor_cost_amount_snapshot=500))
    db.commit()
    november=client.get("/api/v1/management-insights?month=2026-11",headers=headers).json()
    december=client.get("/api/v1/management-insights?month=2026-12",headers=headers).json()
    assert november["time"]["closed_sessions"]==0
    assert december["time"]["closed_sessions"]==1 and Decimal(december["time"]["recorded_labor_cost"])==0
    assert december["time"]["sessions_without_labor_cost"]==1
    assert client.get("/api/v1/management-insights?month=2026-13",headers=headers).status_code==422
    assert client.get("/api/v1/management-insights?month=9999-01",headers=headers).status_code==422
