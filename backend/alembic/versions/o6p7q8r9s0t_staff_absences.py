from alembic import op
import sqlalchemy as sa

revision = "o6p7q8r9s0t"
down_revision = "n5o6p7q8r9s"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("staff_absences", sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("employee_id", sa.Integer, sa.ForeignKey("staff_employees.id"), nullable=False),
        sa.Column("substitute_id", sa.Integer, sa.ForeignKey("staff_employees.id")),
        sa.Column("starts_on", sa.Date, nullable=False), sa.Column("ends_on", sa.Date, nullable=False),
        sa.Column("kind", sa.String(32), nullable=False))
    op.create_index("ix_staff_absences_company_id", "staff_absences", ["company_id"])
    op.create_table("staff_reservation_days", sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("absence_id", sa.Integer, sa.ForeignKey("staff_absences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.Integer, sa.ForeignKey("staff_employees.id"), nullable=False),
        sa.Column("day", sa.Date, nullable=False), sa.UniqueConstraint("employee_id","day",name="uq_staff_reservation_day"))
    op.create_index("ix_staff_reservation_days_absence_id","staff_reservation_days",["absence_id"])


def downgrade():
    op.drop_table("staff_reservation_days")
    op.drop_table("staff_absences")
