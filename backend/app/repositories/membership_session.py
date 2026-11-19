"""Read persisted lifecycle values without triggering an ORM autoflush."""
from sqlalchemy import select


def persisted_state(session,member):
    table=member.__table__
    return session.connection().execute(select(table.c.status,table.c.access_class,table.c.started_at,table.c.ended_at).where(table.c.id==member.id)).mappings().first()
