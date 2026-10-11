"""Add uploaded sources, bounded chunks, and presentation provenance."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_sources"
down_revision = "0003_generation_jobs"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "uploaded_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(100), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(150), nullable=False),
        sa.Column("extension", sa.String(10), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("extracted_text", sa.Text()),
        sa.Column("metadata", postgresql.JSONB(), nullable=False),
        sa.Column("error", postgresql.JSONB()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status IN ('uploaded','processing','ready','failed')", name="valid_status"
        ),
        sa.CheckConstraint("size_bytes > 0", name="positive_size"),
    )
    op.create_index("ix_uploaded_sources_status", "uploaded_sources", ["status"])
    op.create_table(
        "source_chunks",
        sa.Column(
            "source_id",
            sa.Uuid(),
            sa.ForeignKey("uploaded_sources.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("index", sa.Integer(), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "presentation_sources",
        sa.Column(
            "presentation_id",
            sa.Uuid(),
            sa.ForeignKey("presentations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "source_id",
            sa.Uuid(),
            sa.ForeignKey("uploaded_sources.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_presentation_sources_source_id", "presentation_sources", ["source_id"])


def downgrade():
    op.drop_table("presentation_sources")
    op.drop_table("source_chunks")
    op.drop_table("uploaded_sources")
