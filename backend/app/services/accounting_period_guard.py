"""Enforce period invariants on all ORM financial writes, including async sessions."""
from sqlalchemy import event,select
from sqlalchemy.orm import Session


def before_flush(db,*_):
    from datetime import datetime,timezone
    from app.services.accounting_record_scope import scopes,SPECS
    from app.services.accounting_period_policy import assert_open
    from app.services.currency_snapshot_guard import check as check_currency
    for records,mutation in ((list(db.new),"insert"),(list(db.dirty),"update"),(list(db.deleted),"delete")):
        for row in records:
            if not hasattr(row,"__tablename__"):continue
            if row.__tablename__=="accounting_period_events" and mutation!="insert":
                from fastapi import HTTPException
                raise HTTPException(409,"El historial de cierres es inmutable.")
            if row.__tablename__ in SPECS:
                field=SPECS[row.__tablename__][0];value=getattr(row,field)
                if isinstance(value,datetime) and value.tzinfo:setattr(row,field,value.astimezone(timezone.utc))
            for company,at in scopes(db,row,mutation):assert_open(db,company,at)
            check_currency(db,row,mutation)


def before_bulk(execution):
    if not(execution.is_insert or execution.is_update or execution.is_delete):return
    from app.services.accounting_record_scope import SPECS,PARENTS
    from app.services.accounting_period_policy import assert_open
    from app.repositories import accounting_period as repo
    statement=execution.statement;table=getattr(statement,"table",None)
    if table is None:return
    if execution.is_insert:
        if table.name not in SPECS and table.name not in PARENTS:return
        parameters=execution.parameters or [{str(getattr(key,"name",key)):getattr(value,"value",None) for key,value in (getattr(statement,"_values",None) or {}).items()}]
        for values in parameters if isinstance(parameters,list) else [parameters]:
            if table.name in SPECS:assert_open(execution.session,values.get("company_id"),values.get(SPECS[table.name][0]))
            else:
                kind,field=PARENTS[table.name];scope=repo.parent(execution.session,kind,values.get(field))
                if scope:assert_open(execution.session,*scope)
        return
    if table.name in SPECS:
        date_field,protected=SPECS[table.name]
        values=getattr(statement,"_values",None) or {}
        if execution.is_update and execution.is_executemany:
            from fastapi import HTTPException
            raise HTTPException(409,"Actualiza operaciones contables mediante sus formularios para preservar el cierre.")
        fields={str(getattr(key,"name",key)) for key in values}
        if execution.is_update and not(fields&protected) and "status" not in fields:return
        rows=execution.session.execute(select(table.c.company_id,table.c[date_field]).where(*statement._where_criteria))
        for company,at in rows:assert_open(execution.session,company,at)
        # Expressions cannot move rows into a closed period through a bulk operation.
        values=getattr(statement,"_values",None) or {}
        for key,value in values.items():
            if str(getattr(key,"name",key))==date_field:
                if not hasattr(value,"value"):
                    from fastapi import HTTPException
                    raise HTTPException(409,"Modifica las fechas contables mediante el formulario de la operación.")
                for company,_ in execution.session.execute(select(table.c.company_id,table.c[date_field]).where(*statement._where_criteria)):
                    assert_open(execution.session,company,value.value)
    elif table.name in PARENTS:
        kind,field=PARENTS[table.name]
        for id in execution.session.scalars(select(table.c[field]).where(*statement._where_criteria)):
            scope=repo.parent(execution.session,kind,id)
            if scope:assert_open(execution.session,*scope)


def transaction_end(db,transaction):
    if transaction.parent is None:
        from app.services.accounting_period_policy import reset
        reset(db)


def install():
    if not event.contains(Session,"before_flush",before_flush):event.listen(Session,"before_flush",before_flush)
    if not event.contains(Session,"do_orm_execute",before_bulk):event.listen(Session,"do_orm_execute",before_bulk)
    if not event.contains(Session,"after_transaction_end",transaction_end):event.listen(Session,"after_transaction_end",transaction_end)
