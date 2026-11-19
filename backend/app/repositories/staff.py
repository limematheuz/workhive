from app.models.staff_employee import StaffEmployee


def list_staff(db, company):
    return db.query(StaffEmployee).filter_by(company_id=company).order_by(StaffEmployee.name).all()


def employee(db, company, employee_id):
    return db.query(StaffEmployee).filter_by(id=employee_id, company_id=company).first()
