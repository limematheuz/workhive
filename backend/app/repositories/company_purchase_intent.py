"""Persistence queries for paid company onboarding."""

from sqlalchemy.orm import Session

from app.models.company_purchase_intent import CompanyPurchaseIntent


def get_by_id(
    db: Session, *, purchase_id: str, lock: bool = False
) -> CompanyPurchaseIntent | None:
    query = db.query(CompanyPurchaseIntent).filter(CompanyPurchaseIntent.id == purchase_id)
    if lock:
        query = query.with_for_update()
    return query.first()


def get_by_activation_token_hash(
    db: Session, *, token_hash: str, lock: bool = False
) -> CompanyPurchaseIntent | None:
    query = db.query(CompanyPurchaseIntent).filter(
        CompanyPurchaseIntent.activation_token_hash == token_hash
    )
    if lock:
        query = query.with_for_update()
    return query.first()


def get_by_stripe_checkout_session(
    db: Session, *, checkout_session_id: str, lock: bool = False
) -> CompanyPurchaseIntent | None:
    query = (
        db.query(CompanyPurchaseIntent)
        .filter(CompanyPurchaseIntent.stripe_checkout_session_id == checkout_session_id)
    )
    if lock:
        query = query.with_for_update()
    return query.first()


def get_by_stripe_subscription(
    db: Session, *, subscription_id: str, lock: bool = False
) -> CompanyPurchaseIntent | None:
    query = (
        db.query(CompanyPurchaseIntent)
        .filter(CompanyPurchaseIntent.stripe_subscription_id == subscription_id)
    )
    if lock:
        query = query.with_for_update()
    return query.first()
