"""phase 2 content and configuration

Revision ID: 0002_content
Revises: 0001_baseline
Create Date: 2026-09-23 16:16:08.836431
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_content"
down_revision: str | Sequence[str] | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Additive upgrade from Phase 1; existing tables and records are untouched.
    op.create_table(
        "app_configs",
        sa.Column("namespace", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_app_configs")),
        sa.UniqueConstraint("namespace", "key", name=op.f("uq_app_configs_namespace")),
    )
    op.create_table(
        "feature_flags",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_feature_flags")),
        sa.UniqueConstraint("key", name=op.f("uq_feature_flags_key")),
    )
    op.create_table(
        "themes",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("css", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("NOT is_default OR is_active", name=op.f("ck_themes_default_is_active")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_themes")),
        sa.UniqueConstraint("slug", name=op.f("uq_themes_slug")),
    )
    op.create_index(
        "uq_themes_one_default",
        "themes",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_table(
        "presentations",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("theme_id", sa.Uuid(), nullable=True),
        sa.Column("markdown", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'ready', 'archived')", name=op.f("ck_presentations_valid_status")
        ),
        sa.ForeignKeyConstraint(
            ["theme_id"],
            ["themes.id"],
            name=op.f("fk_presentations_theme_id_themes"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_presentations")),
    )
    op.create_table(
        "templates",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("category", sa.String(length=100), server_default="general", nullable=False),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column("theme_id", sa.Uuid(), nullable=True),
        sa.Column("starter_markdown", sa.Text(), server_default="", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["theme_id"],
            ["themes.id"],
            name=op.f("fk_templates_theme_id_themes"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_templates")),
    )
    op.create_table(
        "slides",
        sa.Column("presentation_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("raw_markdown", sa.Text(), server_default="", nullable=False),
        sa.Column("structured_content", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("speaker_notes", sa.Text(), nullable=True),
        sa.Column("visual_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("position >= 0", name=op.f("ck_slides_nonnegative_position")),
        sa.ForeignKeyConstraint(
            ["presentation_id"],
            ["presentations.id"],
            name=op.f("fk_slides_presentation_id_presentations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_slides")),
        sa.UniqueConstraint(
            "presentation_id",
            "position",
            deferrable=True,
            initially="DEFERRED",
            name="uq_slides_presentation_position",
        ),
    )
    op.create_index(op.f("ix_slides_presentation_id"), "slides", ["presentation_id"], unique=False)


def downgrade() -> None:
    # Explicit downgrade removes Phase 2 tables; never invoked by startup or seed.
    op.drop_index(op.f("ix_slides_presentation_id"), table_name="slides")
    op.drop_table("slides")
    op.drop_table("templates")
    op.drop_table("presentations")
    op.drop_index(
        "uq_themes_one_default", table_name="themes", postgresql_where=sa.text("is_default")
    )
    op.drop_table("themes")
    op.drop_table("feature_flags")
    op.drop_table("app_configs")
