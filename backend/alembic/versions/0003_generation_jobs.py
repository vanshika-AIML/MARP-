"""Add durable generation jobs, without altering Phase 1-3 tables."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_generation_jobs"
down_revision = "0002_content"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "generation_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column(
            "presentation_id", sa.Uuid(), sa.ForeignKey("presentations.id", ondelete="SET NULL")
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("current_step", sa.String(100)),
        sa.Column("request", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("error", postgresql.JSONB()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed', 'cancelled')",
            name="valid_status",
        ),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="valid_progress"),
    )
    op.create_index("ix_generation_jobs_status", "generation_jobs", ["status"])
    op.create_index("ix_generation_jobs_presentation_id", "generation_jobs", ["presentation_id"])


def downgrade():
    op.drop_table("generation_jobs")
