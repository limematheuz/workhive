
from alembic import op
import sqlalchemy as sa

revision = "t1u2v3w4x5y"
down_revision = "s0t1u2v3w4x"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("vehicles",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("company_id",sa.Integer,sa.ForeignKey("companies.id"),nullable=False,index=True),
        sa.Column("registration",sa.String(30),nullable=False),sa.Column("name",sa.String(140),nullable=False),
        sa.Column("odometer",sa.Numeric(12,1),nullable=False,server_default="0"),
        sa.Column("service_due_on",sa.Date),sa.Column("status",sa.String(20),nullable=False,server_default="active"))
    op.create_table("vehicle_journeys",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("vehicle_id",sa.Integer,sa.ForeignKey("vehicles.id"),nullable=False,index=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False),
        sa.Column("location_id",sa.Integer,sa.ForeignKey("locations.id"),nullable=False),
        sa.Column("starts_at",sa.DateTime(timezone=True),nullable=False),
        sa.Column("ends_at",sa.DateTime(timezone=True),nullable=False),
        sa.Column("start_km",sa.Numeric(12,1),nullable=False),sa.Column("end_km",sa.Numeric(12,1),nullable=False),
        sa.Column("notes",sa.Text))
    op.create_table("resource_custody",
        sa.Column("id",sa.Integer,primary_key=True),
        sa.Column("equipment_id",sa.Integer,sa.ForeignKey("location_equipment.id"),nullable=False,index=True),
        sa.Column("employee_id",sa.Integer,sa.ForeignKey("staff_employees.id"),nullable=False),
        sa.Column("delivered_by",sa.Integer,sa.ForeignKey("users.id"),nullable=False),
        sa.Column("delivered_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column("returned_at",sa.DateTime(timezone=True)),
        sa.Column("returned_to",sa.Integer,sa.ForeignKey("users.id")),sa.Column("notes",sa.Text))


def downgrade():
    op.drop_table("resource_custody")
    op.drop_table("vehicle_journeys")
    op.drop_table("vehicles")
