"""Production query indexes.

Revision ID: 0006_hardening
Revises: 0005_media
"""

from alembic import op

revision = "0006_hardening"
down_revision = "0005_media"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_presentations_status_updated", "presentations", ["status", "updated_at"])
    op.create_index("ix_themes_active_sort", "themes", ["is_active", "sort_order"])
    op.create_index("ix_templates_active_sort", "templates", ["is_active", "sort_order"])
    op.create_index(
        "ix_generation_jobs_status_updated", "generation_jobs", ["status", "updated_at"]
    )
    op.create_index(
        "ix_uploaded_sources_status_updated", "uploaded_sources", ["status", "updated_at"]
    )
    op.create_index("ix_media_assets_provider_created", "media_assets", ["provider", "created_at"])
    op.create_index("ix_media_cache_expires_at", "media_cache", ["expires_at"])


def downgrade():
    op.drop_index("ix_media_cache_expires_at", table_name="media_cache")
    op.drop_index("ix_media_assets_provider_created", table_name="media_assets")
    op.drop_index("ix_uploaded_sources_status_updated", table_name="uploaded_sources")
    op.drop_index("ix_generation_jobs_status_updated", table_name="generation_jobs")
    op.drop_index("ix_templates_active_sort", table_name="templates")
    op.drop_index("ix_themes_active_sort", table_name="themes")
    op.drop_index("ix_presentations_status_updated", table_name="presentations")
