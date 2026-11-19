import asyncio
import logging
from app.db.session import SessionLocal
from datetime import datetime,timezone
from app.repositories.operations_automation import configured
from app.services.operations_automation_service import run_company

logger=logging.getLogger("workhive.operations_automation")


def run_checks():
    db=SessionLocal()
    try:
        for settings in configured(db):
            try:
                run_company(db,settings)
            except Exception:
                db.rollback()
                logger.exception("Operational automation failed",extra={"company_id":settings.company_id})
                settings.last_run=datetime.now(timezone.utc)
                settings.last_result="No se pudo completar la comprobación. Revisa permisos y configuración y vuelve a ejecutar."
                db.commit()
    finally:
        db.close()


async def periodic_operations_automation():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(run_checks)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Operational automation check failed")
