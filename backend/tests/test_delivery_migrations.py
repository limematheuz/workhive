"""Exercise the delivery chain against the schema that existed before it."""
import importlib.util
from datetime import date,datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import MetaData,create_engine,inspect,select
from alembic.runtime.migration import MigrationContext
from alembic.operations import Operations
from app.db.base import Base

NEW_TABLES={
    "additional_work","advisory_access","company_preferences","staff_shifts","offline_work",
    "vehicles","vehicle_journeys","resource_custody","staff_accounts","staff_document_receipts",
    "internal_requests","import_batches","operations_automations","staff_document_files",
    "quote_cost_estimates","material_plans","subcontracts","saved_reports","advisory_requests",
    "company_hierarchy","work_crews","work_crew_members","work_order_scopes","task_space_staff",
    "staff_checklist_progress","quote_work_scopes","task_client_publications",
    "task_client_publication_photos","task_client_acceptances","accounting_periods",
    "accounting_period_events","operations_approval_policies","purchase_approvals",
    "task_close_approvals","purchase_budget_links",
    "registered_documents","document_revisions","document_signatures",
    "labor_communications","labor_communication_events",
}
ADDED_COLUMNS={
    "company_memberships":{"session_version"},
    "departments":{"unit_type"},
    "locations":{"is_temporary"},
    "work_sessions":{"company_id"},
    "invoices":{"currency_snapshot"},
    "expenses":{"currency_snapshot"},
    "customer_payments":{"currency_snapshot"},
    "sales_ledger_records":{"currency_snapshot"},
    "customer_payment_allocations":{"exchange_difference_eur","native_amount","native_currency"},
}
PREFIXES=[
    "q8r9s0t1u2v","r9s0t1u2v3w","s0t1u2v3w4x","t1u2v3w4x5y","u2v3w4x5y6z",
    "v3w4x5y6z7a","w4x5y6z7a8b","x5y6z7a8b9c","y6z7a8b9c0d","z7a8b9c0d1e",
    "a8b9c0d1e2f","b9c0d1e2f3g","c0d1e2f3g4h","d1e2f3g4h5i","e2f3g4h5i6j",
    "f3g4h5i6j7k","g4h5i6j7k8l","h5i6j7k8l9m","i6j7k8l9m0n","j7k8l9m0n1o",
    "k8l9m0n1o2p","l9m0n1o2p3q","m0n1o2p3q4r","n1o2p3q4r5s",
]


def legacy_metadata():
    # Clone first: changing Base.metadata here would corrupt all subsequent tests.
    metadata=MetaData()
    for table in Base.metadata.sorted_tables:
        if table.name not in NEW_TABLES:table.to_metadata(metadata)
    for table_name,columns in ADDED_COLUMNS.items():
        table=metadata.tables[table_name]
        for constraint in list(table.constraints):
            if constraint.name=="ck_department_unit_type":table.constraints.remove(constraint)
            elif any(column.name in columns for column in getattr(constraint,"columns",())):table.constraints.remove(constraint)
        for index in list(table.indexes):
            if any(column.name in columns for column in index.columns):table.indexes.remove(index)
        for column in columns:table._columns.remove(table.c[column])
    return metadata


def migration_modules():
    directory=Path(__file__).parents[1]/"alembic"/"versions"
    modules=[]
    for prefix in PREFIXES:
        # Some older revisions share this prefix with an extra digit; require the separator.
        paths=list(directory.glob(prefix+"_*.py"))
        assert len(paths)==1,(prefix,paths)
        spec=importlib.util.spec_from_file_location(prefix,paths[0])
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        assert module.revision==prefix
        if modules:assert module.down_revision==modules[-1].revision
        modules.append(module)
    return modules


def seed_legacy_records(connection,metadata):
    at=datetime(2026,10,15,12)
    values={
        "companies":dict(id=1,name="Legacy company",tax_id="LEGACY-MIGRATION",address="Test address",phone="600000000",email="migration@example.test"),
        "roles":dict(id=1,name="admin"),
        "users":dict(id=1,email="migration-user@example.test",hashed_password="unused",role_id=1,company_id=1),
        "company_memberships":dict(id=1,company_id=1,user_id=1,access_class="admin",status="active"),
        "clients":dict(id=1,company_id=1,name="Legacy client",address="Test address",city="Madrid",postal_code="28001",country="ES"),
        "locations":dict(id=1,name="Legacy site",address="Test address",city="Madrid",owner_company_id=1,managing_company_id=1,client_id=1),
        "work_sessions":dict(id=1,user_id=1,location_id=1,start_time=at,end_time=datetime(2026,10,15,13),labor_cost_company_id=1),
        "departments":dict(id=1,company_id=1,name="Original area",normalized_name="original area"),
        "invoices":dict(id=1,company_id=1,client_id=1,invoice_number="LEGACY-1",issue_date=at,status="issued",base_amount=100,tax_amount=21,total_amount=121),
        "expenses":dict(id=1,company_id=1,expense_date=at,category="General",description="Legacy expense",base_amount=10,tax_amount=2.1,total_amount=12.1),
        "customer_payments":dict(id=1,company_id=1,client_id=1,received_at=at,amount=50,status="received"),
        "sales_ledger_records":dict(id=1,company_id=1,document_number="LEGACY-MANUAL",entry_date=date(2026,10,15),client_name="Legacy client",base_amount=20,tax_amount=4.2,total_amount=24.2,payment_status="pending"),
        "customer_payment_allocations":dict(id=1,payment_id=1,invoice_id=1,amount=50),
    }
    for name,data in values.items():connection.execute(metadata.tables[name].insert().values(**data))


def columns(connection,name):return {column["name"]:column for column in inspect(connection).get_columns(name)}


def assert_legacy_values(connection,metadata):
    for name,amount in (("invoices","121.00"),("expenses","12.10"),("sales_ledger_records","24.20")):
        actual=connection.scalar(select(metadata.tables[name].c.total_amount).where(metadata.tables[name].c.id==1))
        assert Decimal(str(actual)).quantize(Decimal(".01"))==Decimal(amount)
    assert connection.scalar(select(metadata.tables["customer_payments"].c.amount))==50
    assert connection.scalar(select(metadata.tables["customer_payment_allocations"].c.amount))==50


def test_delivery_migration_chain_roundtrip():
    engine=create_engine("sqlite://")
    metadata=legacy_metadata();metadata.create_all(engine)
    modules=migration_modules()
    try:
        with engine.begin() as connection:
            seed_legacy_records(connection,metadata)
            baseline_columns={name:set(columns(connection,name)) for name in ADDED_COLUMNS}
            assert all(not ADDED_COLUMNS[name]&names for name,names in baseline_columns.items())
            assert not NEW_TABLES&set(inspect(connection).get_table_names())
            with Operations.context(MigrationContext.configure(connection)):
                for module in modules:module.upgrade()
                assert NEW_TABLES<=set(inspect(connection).get_table_names())
                for name,added in ADDED_COLUMNS.items():assert added<=set(columns(connection,name))
                assert "can_close_periods" in columns(connection,"advisory_access")
                assert "labor_amount" in columns(connection,"quote_cost_estimates")
                assert "active_request_id" in columns(connection,"purchase_budget_links")
                assert columns(connection,"task_space_staff")["space_id"]["nullable"] is True
                assert connection.exec_driver_sql("SELECT is_temporary FROM locations WHERE id=1").scalar_one()==0
                assert connection.exec_driver_sql("SELECT company_id FROM work_sessions WHERE id=1").scalar_one()==1
                assert connection.exec_driver_sql("SELECT session_version FROM company_memberships WHERE id=1").scalar_one()==0
                assert connection.exec_driver_sql("SELECT unit_type FROM departments WHERE id=1").scalar_one()=="area"
                for name in ("invoices","expenses","customer_payments","sales_ledger_records"):
                    assert connection.exec_driver_sql(f"SELECT currency_snapshot FROM {name} WHERE id=1").scalar_one() is None
                difference,native_amount,native_currency=connection.exec_driver_sql(
                    "SELECT exchange_difference_eur,native_amount,native_currency FROM customer_payment_allocations WHERE id=1").one()
                assert difference==0 and native_amount is None and native_currency is None
                assert any(item["name"]=="ck_department_unit_type" for item in inspect(connection).get_check_constraints("departments"))
                assert_legacy_values(connection,metadata)
                for module in reversed(modules):module.downgrade()
                assert not NEW_TABLES&set(inspect(connection).get_table_names())
                for name,original in baseline_columns.items():assert set(columns(connection,name))==original
                assert not any(item["name"]=="ck_department_unit_type" for item in inspect(connection).get_check_constraints("departments"))
                assert_legacy_values(connection,metadata)
        # The real model registry still describes the latest schema after the local clone was changed.
        assert "unit_type" in Base.metadata.tables["departments"].c
        assert "currency_snapshot" in Base.metadata.tables["invoices"].c
        assert "is_temporary" in Base.metadata.tables["locations"].c
        assert "company_id" in Base.metadata.tables["work_sessions"].c
        assert "session_version" in Base.metadata.tables["company_memberships"].c
        assert Base.metadata.tables["task_space_staff"].c.space_id.nullable is True
    finally:engine.dispose()
