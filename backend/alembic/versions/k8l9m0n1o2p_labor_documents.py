"""Linked document revisions/signatures and scoped payroll communications."""
from alembic import op
import sqlalchemy as sa
revision="k8l9m0n1o2p"
down_revision="j7k8l9m0n1o"
branch_labels=None
depends_on=None


def upgrade():
    op.create_table('registered_documents',
        sa.Column('id',sa.Integer(),nullable=False,primary_key=True),
        sa.Column('company_id',sa.Integer(),sa.ForeignKey('companies.id'),nullable=False),
        sa.Column('owner_type',sa.String(length=20),nullable=False),
        sa.Column('owner_id',sa.Integer(),nullable=False),
        sa.Column('title',sa.String(length=255),nullable=False),
        sa.Column('document_type',sa.String(length=40),nullable=False),
        sa.Column('origin_staff_file_id',sa.Integer(),sa.ForeignKey('staff_document_files.id'),nullable=True),
        sa.Column('origin_location_document_id',sa.Integer(),sa.ForeignKey('location_documents.id'),nullable=True),
        sa.Column('published_revision',sa.Integer(),nullable=True),
        sa.Column('created_by',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint('origin_location_document_id',name=None),
        sa.CheckConstraint("owner_type IN ('client','location','staff')",name='ck_registered_document_owner'),
        sa.UniqueConstraint('origin_staff_file_id',name=None),
    )
    op.create_index('ix_registered_documents_company_id','registered_documents',['company_id'],unique=False)
    op.create_table('document_revisions',
        sa.Column('id',sa.Integer(),nullable=False,primary_key=True),
        sa.Column('document_id',sa.Integer(),sa.ForeignKey('registered_documents.id'),nullable=False),
        sa.Column('revision',sa.Integer(),nullable=False),
        sa.Column('title',sa.String(length=255),nullable=False),
        sa.Column('file_name',sa.String(length=255),nullable=False),
        sa.Column('content_type',sa.String(length=120),nullable=False),
        sa.Column('storage_key',sa.String(length=500),nullable=False),
        sa.Column('size_bytes',sa.Integer(),nullable=False),
        sa.Column('sha256',sa.String(length=64),nullable=False),
        sa.Column('revision_hash',sa.String(length=64),nullable=False),
        sa.Column('staff_file_id',sa.Integer(),sa.ForeignKey('staff_document_files.id'),nullable=True),
        sa.Column('location_document_id',sa.Integer(),sa.ForeignKey('location_documents.id'),nullable=True),
        sa.Column('expires_on',sa.Date(),nullable=True),
        sa.Column('created_by',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint('document_id','revision',name='uq_document_revision'),
    )
    op.create_index('ix_document_revisions_document_id','document_revisions',['document_id'],unique=False)
    op.create_table('document_signatures',
        sa.Column('id',sa.Integer(),nullable=False,primary_key=True),
        sa.Column('revision_id',sa.Integer(),sa.ForeignKey('document_revisions.id'),nullable=False),
        sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('signer_name',sa.String(length=200),nullable=False),
        sa.Column('revision_hash',sa.String(length=64),nullable=False),
        sa.Column('statement_version',sa.String(length=50),nullable=False),
        sa.Column('consent_text',sa.Text(),nullable=False),
        sa.Column('signed_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint('revision_id','user_id',name='uq_document_signer'),
    )
    op.create_index('ix_document_signatures_revision_id','document_signatures',['revision_id'],unique=False)
    op.create_table('labor_communications',
        sa.Column('id',sa.Integer(),nullable=False,primary_key=True),
        sa.Column('company_id',sa.Integer(),sa.ForeignKey('companies.id'),nullable=False),
        sa.Column('employee_id',sa.Integer(),sa.ForeignKey('staff_employees.id'),nullable=False),
        sa.Column('recipient_user_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('kind',sa.String(length=30),nullable=False),
        sa.Column('effective_on',sa.Date(),nullable=False),
        sa.Column('subject',sa.String(length=200),nullable=False),
        sa.Column('description',sa.Text(),nullable=False),
        sa.Column('document_revision_ids',sa.JSON(),nullable=False),
        sa.Column('status',sa.String(length=20),nullable=False),
        sa.Column('revision',sa.Integer(),nullable=False),
        sa.Column('created_by',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index('ix_labor_communications_recipient_user_id','labor_communications',['recipient_user_id'],unique=False)
    op.create_index('ix_labor_communications_company_id','labor_communications',['company_id'],unique=False)
    op.create_table('labor_communication_events',
        sa.Column('id',sa.Integer(),nullable=False,primary_key=True),
        sa.Column('communication_id',sa.Integer(),sa.ForeignKey('labor_communications.id'),nullable=False),
        sa.Column('actor_user_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('status',sa.String(length=20),nullable=False),
        sa.Column('note',sa.Text(),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index('ix_labor_communication_events_communication_id','labor_communication_events',['communication_id'],unique=False)


def downgrade():
    op.drop_table('labor_communication_events')
    op.drop_table('labor_communications')
    op.drop_table('document_signatures')
    op.drop_table('document_revisions')
    op.drop_table('registered_documents')
