from app.core.security import get_password_hash
from app.models.company import Company
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.user import User
from app.services import user_service
from credentials import TEST_SECRET


def test_user_stats_exclude_rejected_tasks_from_operational_total(db):
    company = Company(
        name="Profile Stats Company",
        tax_id="PROFILE-STATS",
        address="Calle Estadisticas 1",
        phone="600000000",
        email="profile-stats@example.com",
        subscription_plan="pro",
        subscription_status="active",
        onboarding_completed=False,
    )
    db.add(company)
    db.flush()

    worker = User(
        email="profile-stats-worker@example.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Profile Stats Worker",
        role_id=3,
        company_id=company.id,
        is_active=True,
    )
    location = Location(
        name="Ubicacion de estadisticas",
        address="Calle Estadisticas 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add_all([worker, location])
    db.flush()

    db.add_all(
        [
            TaskItem(
                title=f"Tarea {status}",
                unit="servicio",
                company_id=company.id,
                location_id=location.id,
                user_id=worker.id,
                status=status,
            )
            for status in ("completed", "pending", "progress", "rejected")
        ]
    )
    db.commit()

    stats = user_service.get_user_stats(db, worker.id, worker)

    assert stats.tasks_completed == 1
    assert stats.tasks_pending == 1
    assert stats.total_tasks == 3
