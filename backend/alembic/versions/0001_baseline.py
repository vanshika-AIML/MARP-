"""Infrastructure baseline. No application tables in Phase 1."""

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
