"""Permission snapshots are written in the same transaction as the access change."""
from app.models.audit_log import AuditLog


def record_permission_change(db, actor, company_id, entity_type, identifier, field, before, after):
    if before == after:
        return
    db.add(AuditLog(company_id=company_id, actor_user_id=actor.id, action="record.updated",
        entity_type=entity_type, entity_id=str(identifier), details={"changes":[{
            "field":field, "before":before, "after":after, "before_known":True,
        }]}))


def assignment_snapshot(assignments):
    result = []
    for assignment in assignments:
        if not assignment.is_active:
            continue
        name = assignment.permission_profile.name
        scopes = sorted(f"{scope.scope_type}:{scope.scope_id}" for scope in assignment.scopes)
        result.append(name + " [" + ", ".join(scopes) + "]")
    return "; ".join(sorted(result))
