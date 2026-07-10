from dataclasses import dataclass

from sqlalchemy import MetaData, Table, and_, exists, func, inspect, or_, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import base as _models  # noqa: F401
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.task_item import TaskItem
from app.models.user import User


@dataclass(frozen=True)
class IntegrityIssue:
    check: str
    count: int
    sample_ids: tuple[int | str, ...] = ()


def _foreign_key_orphans(engine: Engine) -> list[IntegrityIssue]:
    inspector = inspect(engine)
    metadata = MetaData()
    issues: list[IntegrityIssue] = []

    for table_name in inspector.get_table_names():
        child = Table(table_name, metadata, autoload_with=engine)
        primary_key = next(iter(child.primary_key.columns), None)

        for foreign_key in inspector.get_foreign_keys(table_name):
            child_columns = foreign_key.get("constrained_columns") or []
            parent_columns = foreign_key.get("referred_columns") or []
            parent_table_name = foreign_key.get("referred_table")
            if (
                len(child_columns) != 1
                or len(parent_columns) != 1
                or not parent_table_name
            ):
                continue

            parent_table = Table(parent_table_name, metadata, autoload_with=engine)
            parent = (
                parent_table.alias(f"{parent_table_name}_parent")
                if parent_table_name == table_name
                else parent_table
            )
            child_column = child.c[child_columns[0]]
            parent_column = parent.c[parent_columns[0]]
            orphan_filter = and_(
                child_column.is_not(None),
                parent_column.is_(None),
            )
            join = child.outerjoin(parent, child_column == parent_column)

            with engine.connect() as connection:
                count = connection.scalar(
                    select(func.count()).select_from(join).where(orphan_filter)
                )
                if not count:
                    continue

                sample_column = primary_key if primary_key is not None else child_column
                samples = connection.scalars(
                    select(sample_column)
                    .select_from(join)
                    .where(orphan_filter)
                    .limit(10)
                ).all()

            issues.append(
                IntegrityIssue(
                    check=f"{table_name}.{child_column.name} -> "
                    f"{parent_table_name}.{parent_column.name}",
                    count=count,
                    sample_ids=tuple(samples),
                )
            )

    return issues


def _task_company_issues(db: Session) -> list[IntegrityIssue]:
    issues: list[IntegrityIssue] = []
    mismatched_filter = or_(
        User.company_id.is_(None),
        User.company_id != TaskItem.company_id,
    )

    mismatched_assignee = db.scalars(
        select(TaskItem.id)
        .join(User, User.id == TaskItem.user_id)
        .where(mismatched_filter)
        .limit(10)
    ).all()
    mismatched_count = db.scalar(
        select(func.count(TaskItem.id))
        .join(User, User.id == TaskItem.user_id)
        .where(mismatched_filter)
    )
    if mismatched_count:
        issues.append(
            IntegrityIssue(
                check="task assignee belongs to task company",
                count=mismatched_count,
                sample_ids=tuple(mismatched_assignee),
            )
        )

    has_explicit_access = exists(
        select(LocationCompanyAccess.location_id).where(
            LocationCompanyAccess.location_id == TaskItem.location_id,
            LocationCompanyAccess.company_id == TaskItem.company_id,
        )
    )
    inaccessible_filter = and_(
        TaskItem.company_id != Location.owner_company_id,
        or_(
            Location.managing_company_id.is_(None),
            TaskItem.company_id != Location.managing_company_id,
        ),
        ~has_explicit_access,
    )
    inaccessible_tasks = db.scalars(
        select(TaskItem.id)
        .join(Location, Location.id == TaskItem.location_id)
        .where(inaccessible_filter)
        .limit(10)
    ).all()
    inaccessible_count = db.scalar(
        select(func.count(TaskItem.id))
        .join(Location, Location.id == TaskItem.location_id)
        .where(inaccessible_filter)
    )
    if inaccessible_count:
        issues.append(
            IntegrityIssue(
                check="task company can access task location",
                count=inaccessible_count,
                sample_ids=tuple(inaccessible_tasks),
            )
        )

    return issues


def audit_data_integrity(db: Session) -> list[IntegrityIssue]:
    engine = db.get_bind()
    return [*_foreign_key_orphans(engine), *_task_company_issues(db)]
