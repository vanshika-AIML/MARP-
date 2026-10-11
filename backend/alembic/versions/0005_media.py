"""Media assets and durable visual request cache."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_media"
down_revision = "0004_sources"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("source_url", sa.Text()),
        sa.Column("stored_path", sa.String(100), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(50), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(300), nullable=False),
        sa.Column("attribution", postgresql.JSONB()),
        sa.Column("prompt_query", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "media_cache",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("asset_id", sa.Uuid(), sa.ForeignKey("media_assets.id", ondelete="CASCADE")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("media_cache")
    op.drop_table("media_assets")
