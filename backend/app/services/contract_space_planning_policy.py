"""Reuse the accepted operational scope and bound quoted visits."""
from types import SimpleNamespace
from fastapi import HTTPException
from app.repositories import workforce_plan as repo,service_estimator as estimator_repo
from app.services import estimator_quote_service


def configuration(db,company,contract_id,location_id):
    contract=repo.contract_record(db,company,contract_id)
    if contract is None or contract.status!="active":raise HTTPException(404,"Contrato activo no encontrado")
    scope=estimator_repo.quote_scope(db,company,contract.source_quote_id)
    if scope is None or scope.location_id!=location_id:return contract,None
    config=scope.configuration or {}
    order=SimpleNamespace(service_contract=contract,company_id=company,location_id=location_id)
    if not estimator_quote_service.pricing_for_order(db,order,config.get("spaces",[])):return contract,None
    return contract,config


def read_scope(db,company,contract_id,location_id):
    contract,config=configuration(db,company,contract_id,location_id)
    if config is None:return dict(spaces=[],occurrences=None,remaining_occurrences=None)
    total=int(config["occurrences"])
    used=repo.contract_execution_count(db,company,contract.id)
    return dict(spaces=config.get("spaces",[]),occurrences=total,remaining_occurrences=max(0,total-used))


def require_capacity(db,order):
    contract,config=configuration(db,order.company_id,order.service_contract_id,order.location_id)
    if config and repo.contract_execution_count(db,order.company_id,contract.id)>=int(config["occurrences"]):
        raise HTTPException(409,"Ya se han generado todas las visitas de este presupuesto aceptado. Amplía el acuerdo antes de crear más ejecuciones.")
