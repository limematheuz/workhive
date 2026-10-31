"""Real PostgreSQL sessions must preserve stock and immutable correction history."""
import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier, Event, Lock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.database_url import to_sync_database_url
from app.db.base import Base
from app.models.expense import Expense
from app.models.inventory import InventoryMovement
from app.models.inventory_purchase import InventoryPurchase
from app.models.role import Role
from app.models.user import User
from app.repositories import inventory as inventory_repo
from app.schemas.inventory import InventoryMaterialCreate, InventorySupplierCreate, InventoryWarehouseCreate
from app.schemas.inventory_purchase import InventoryPurchaseCreate, InventoryPurchaseReversal
from app.services import inventory_purchase_service as purchases
from app.services import inventory_service as inventory
from app.services.entitlement_catalog import seed_default_plan_catalog
from tests.test_location_workspace import _admin, _company

pytestmark = pytest.mark.skipif(
    not os.getenv("MIGRATION_TEST_DATABASE_URL"),
    reason="PostgreSQL integration database is not configured",
)


@pytest.fixture()
def inventory_sessions():
    """Create only a uniquely owned schema; never clear the configured database."""
    url = to_sync_database_url(os.environ["MIGRATION_TEST_DATABASE_URL"])
    schema = "qa_inventory_" + uuid4().hex
    control = create_engine(url)
    with control.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={
        "options": f"-c search_path={schema} -c lock_timeout=5000 -c statement_timeout=10000",
    })
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        Base.metadata.create_all(engine)
        with factory() as session:
            session.add_all([Role(id=i, name=name) for i, name in enumerate(
                ["admin", "manager", "viewer", "superadmin", "external_portal", "partner_portal", "client_portal"], 1
            )])
            seed_default_plan_catalog(session)
            session.commit()
        yield factory
    finally:
        engine.dispose()
        with control.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        control.dispose()


def _catalogue(factory, *, count=1):
    with factory() as session:
        company = _company(session, "InvRace")
        company.subscription_plan = "top"
        session.commit()
        user = _admin(session, company)
        supplier = inventory.create_supplier(session, user, InventorySupplierCreate(name="QA supplier"))
        materials = [inventory.create_material(session, user, InventoryMaterialCreate(
            name=f"QA material {i}", sku=f"QA-{i}", supplier_id=supplier.id,
        )).id for i in range(count)]
        warehouses = [inventory.create_warehouse(session, user, InventoryWarehouseCreate(
            name=f"QA warehouse {i}",
        )).id for i in range(count)]
        return user.id, supplier.id, materials, warehouses


def _receive(factory, user_id, supplier_id, pairs):
    with factory() as session:
        purchase = purchases.create_purchase(session, session.get(User, user_id), InventoryPurchaseCreate(
            supplier_id=supplier_id, expense_date="2026-10-31T12:00:00Z",
            description="QA concurrent receipts", tax_amount="1.00",
            lines=[dict(material_id=m, warehouse_id=w, quantity="5", unit_cost="1",
                        lot_code=f"QA-{m}-{w}", lot_expires_at="2070-01-01") for m, w in pairs],
        ))
        return purchase.id, purchase.expense_id


def _race(factory, user_id, identifiers, operation=None):
    barrier = Barrier(2)

    def correct(purchase_id):
        with factory() as session:
            user = session.get(User, user_id)
            barrier.wait(timeout=5)
            try:
                if operation is None:
                    purchases.reverse_purchase(session, user, purchase_id, InventoryPurchaseReversal(reason="QA concurrent correction"))
                else:
                    operation(session, user, purchase_id)
                return "committed"
            except HTTPException as error:
                session.rollback()
                assert error.status_code == 409, error.detail
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as executor:
        return list(executor.map(correct, identifiers))


def test_same_purchase_can_only_be_corrected_once_with_surplus_stock(inventory_sessions):
    factory = inventory_sessions
    user_id, supplier_id, materials, warehouses = _catalogue(factory)
    pairs = [(materials[0], warehouses[0])]
    target, expense_id = _receive(factory, user_id, supplier_id, pairs)
    other, other_expense_id = _receive(factory, user_id, supplier_id, pairs)
    assert sorted(_race(factory, user_id, [target, target])) == ["committed", "conflict"]
    with factory() as session:
        assert session.get(InventoryPurchase, target).status == "reversed"
        assert session.get(InventoryPurchase, other).status == "received"
        assert session.get(Expense, expense_id).is_active is False
        assert session.get(Expense, other_expense_id).is_active is True
        assert session.query(InventoryMovement).count() == 3
        user = session.get(User, user_id)
        assert inventory.list_stock_balances(session, user)[0]["available_quantity"] == Decimal("5")
        assert inventory.list_lot_balances(session, user)[0]["available_quantity"] == Decimal("5")


def test_two_purchase_corrections_cannot_spend_the_same_remaining_stock(inventory_sessions):
    from app.schemas.inventory import InventoryMovementCreate
    factory = inventory_sessions
    user_id, supplier_id, materials, warehouses = _catalogue(factory)
    pairs = [(materials[0], warehouses[0])]
    first, first_expense = _receive(factory, user_id, supplier_id, pairs)
    second, second_expense = _receive(factory, user_id, supplier_id, pairs)
    with factory() as session:
        user = session.get(User, user_id)
        lot = inventory.list_lot_balances(session, user)[0]
        inventory.create_movement(session, user, InventoryMovementCreate(
            material_id=materials[0], warehouse_id=warehouses[0], lot_id=lot["id"],
            movement_type="issue", quantity="5",
        ))
    assert sorted(_race(factory, user_id, [first, second])) == ["committed", "conflict"]
    with factory() as session:
        assert sorted(session.get(InventoryPurchase, pid).status for pid in [first, second]) == ["received", "reversed"]
        assert sum(session.get(Expense, eid).is_active for eid in [first_expense, second_expense]) == 1
        assert session.query(InventoryMovement).count() == 4
        user = session.get(User, user_id)
        assert inventory.list_stock_balances(session, user)[0]["available_quantity"] == 0
        assert inventory.list_lot_balances(session, user)[0]["available_quantity"] == 0


def test_crossed_materials_lock_shared_warehouses_without_deadlock(inventory_sessions, monkeypatch):
    factory = inventory_sessions
    user_id, supplier_id, materials, warehouses = _catalogue(factory, count=2)
    first, first_expense = _receive(factory, user_id, supplier_id, list(zip(materials, warehouses)))
    second, second_expense = _receive(factory, user_id, supplier_id, list(zip(materials, reversed(warehouses))))
    # Both transactions start their first warehouse read together. Allow both
    # first locks to be held if their order differs; a consistent order instead
    # makes one transaction wait, then finish after the other's commit.
    get_warehouse = inventory_repo.get_warehouse
    first_attempt = Barrier(2)
    acquired = [Event(), Event()]
    slots = {}
    first_warehouses = {}
    mutex = Lock()

    def interleave(session, **kwargs):
        first_call = False
        with mutex:
            if id(session) not in slots:
                slots[id(session)] = len(slots)
                first_warehouses[slots[id(session)]] = kwargs["warehouse_id"]
                first_call = True
            slot = slots[id(session)]
        if first_call:
            first_attempt.wait(timeout=5)
        result = get_warehouse(session, **kwargs)
        if first_call:
            acquired[slot].set()
            if first_warehouses[0] != first_warehouses[1]:
                assert acquired[1-slot].wait(timeout=5)
        return result

    monkeypatch.setattr(inventory_repo, "get_warehouse", interleave)
    assert _race(factory, user_id, [first, second]) == ["committed", "committed"]
    with factory() as session:
        assert all(session.get(InventoryPurchase, pid).status == "reversed" for pid in [first, second])
        assert all(session.get(Expense, eid).is_active is False for eid in [first_expense, second_expense])
        assert session.query(InventoryMovement).count() == 8
        user = session.get(User, user_id)
        balances = inventory.list_stock_balances(session, user)
        lots = inventory.list_lot_balances(session, user)
        assert len(balances) == len(lots) == 4
        assert all(row["available_quantity"] == 0 for row in balances)
        assert all(row["available_quantity"] == 0 for row in lots)


def _order(factory, user_id):
    from datetime import datetime, timezone
    from app.models.location import Location
    from app.models.work_order import WorkOrder
    with factory() as session:
        user = session.get(User, user_id)
        location = Location(name="QA site", address="QA address", city="Madrid", owner_company_id=user.company_id)
        session.add(location)
        session.flush()
        order = WorkOrder(title="QA concurrent consumption", company_id=user.company_id,
                          location_id=location.id, status="active", scheduled_start_at=datetime.now(timezone.utc))
        session.add(order)
        session.commit()
        return order.id


def _consume(session, user, order_id, material_id, warehouse_id):
    from app.schemas.inventory import InventoryWorkOrderConsumptionCreate
    from app.services import work_order_inventory_service
    lot = inventory.list_lot_balances(session, user)[0]
    return work_order_inventory_service.create_consumption(session, user, order_id, InventoryWorkOrderConsumptionCreate(
        material_id=material_id, warehouse_id=warehouse_id, lot_id=lot["id"], quantity="5",
    ))


def test_purchase_return_and_order_consumption_cannot_spend_the_same_lot(inventory_sessions):
    factory = inventory_sessions
    user_id, supplier_id, materials, warehouses = _catalogue(factory)
    purchase_id, expense_id = _receive(factory, user_id, supplier_id, [(materials[0], warehouses[0])])
    order_id = _order(factory, user_id)

    def operation(session, user, action):
        if action == "consume":
            _consume(session, user, order_id, materials[0], warehouses[0])
        else:
            purchases.reverse_purchase(session, user, purchase_id, InventoryPurchaseReversal(reason="QA return competing with consumption"))

    assert sorted(_race(factory, user_id, ["consume", "return"], operation)) == ["committed", "conflict"]
    with factory() as session:
        user = session.get(User, user_id)
        assert inventory.list_stock_balances(session, user)[0]["available_quantity"] == 0
        assert inventory.list_lot_balances(session, user)[0]["available_quantity"] == 0
        assert session.query(InventoryMovement).count() == 2
        purchase = session.get(InventoryPurchase, purchase_id)
        expense = session.get(Expense, expense_id)
        consumptions = session.query(InventoryMovement).filter(InventoryMovement.work_order_id == order_id).count()
        assert (purchase.status, expense.is_active, consumptions) in [
            ("received", True, 1), ("reversed", False, 0),
        ]


def test_same_order_consumption_correction_only_restores_stock_once(inventory_sessions):
    from app.schemas.inventory import InventoryWorkOrderConsumptionReversal
    from app.services import work_order_inventory_service
    factory = inventory_sessions
    user_id, supplier_id, materials, warehouses = _catalogue(factory)
    purchase_id, expense_id = _receive(factory, user_id, supplier_id, [(materials[0], warehouses[0])])
    order_id = _order(factory, user_id)
    with factory() as session:
        issue_id = _consume(session, session.get(User, user_id), order_id, materials[0], warehouses[0]).id

    def operation(session, user, movement_id):
        work_order_inventory_service.reverse_consumption(session, user, order_id, movement_id,
            InventoryWorkOrderConsumptionReversal(reason="QA duplicate correction"))

    assert sorted(_race(factory, user_id, [issue_id, issue_id], operation)) == ["committed", "conflict"]
    with factory() as session:
        user = session.get(User, user_id)
        assert inventory.list_stock_balances(session, user)[0]["available_quantity"] == Decimal("5")
        assert inventory.list_lot_balances(session, user)[0]["available_quantity"] == Decimal("5")
        assert session.query(InventoryMovement).count() == 3
        assert session.query(InventoryMovement).filter(InventoryMovement.reversal_of_movement_id == issue_id).count() == 1
        assert session.get(InventoryPurchase, purchase_id).status == "received"
        assert session.get(Expense, expense_id).is_active is True
