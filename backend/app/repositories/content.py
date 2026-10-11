from uuid import UUID

from sqlalchemy import func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppConfig, FeatureFlag, Presentation, Slide, Template, Theme


class ContentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, model, resource_id: UUID, *, lock=False):
        query = (
            select(model).where(model.id == resource_id).execution_options(populate_existing=True)
        )
        if lock:
            query = query.with_for_update()
        return await self.session.scalar(query)

    async def list(self, model, *, limit=50, offset=0, search=None, **filters):
        query = select(model)
        if search:
            fields = {
                Presentation: [Presentation.title, Presentation.description],
                Template: [Template.name, Template.description, Template.category],
                Theme: [Theme.name, Theme.description, Theme.slug],
                AppConfig: [AppConfig.namespace, AppConfig.key, AppConfig.description],
                FeatureFlag: [FeatureFlag.key],
            }[model]
            query = query.where(
                or_(*(field.icontains(search, autoescape=True) for field in fields))
            )
        for key, value in filters.items():
            if value is not None:
                query = query.where(getattr(model, key) == value)
        order = {
            Presentation: (Presentation.updated_at.desc(), Presentation.id),
            Template: (Template.sort_order, Template.created_at, Template.id),
            Theme: (Theme.sort_order, Theme.created_at, Theme.id),
            AppConfig: (AppConfig.namespace, AppConfig.key, AppConfig.id),
            FeatureFlag: (FeatureFlag.key, FeatureFlag.id),
        }[model]
        return list(await self.session.scalars(query.order_by(*order).limit(limit).offset(offset)))

    async def slides(self, presentation_id: UUID):
        return list(
            await self.session.scalars(
                select(Slide)
                .where(Slide.presentation_id == presentation_id)
                .order_by(Slide.position, Slide.id)
                .execution_options(populate_existing=True)
            )
        )

    async def lock_themes(self):
        # Serialize default changes even when the table is empty. Lock is transaction scoped.
        await self.session.execute(text("SELECT pg_advisory_xact_lock(732019, 2)"))

    async def list_slides(self, presentation_id, *, limit, offset, search):
        query = select(Slide).where(Slide.presentation_id == presentation_id)
        if search:
            query = query.where(
                or_(
                    Slide.title.icontains(search, autoescape=True),
                    Slide.raw_markdown.icontains(search, autoescape=True),
                )
            )
        return list(
            await self.session.scalars(
                query.order_by(Slide.position, Slide.id).limit(limit).offset(offset)
            )
        )

    async def clear_default(self):
        await self.session.execute(update(Theme).where(Theme.is_default).values(is_default=False))

    async def default_theme(self):
        return await self.session.scalar(select(Theme).where(Theme.is_default))

    async def upsert_config(self, namespace: str, key: str, values: dict):
        statement = insert(AppConfig).values(namespace=namespace, key=key, **values)
        statement = statement.on_conflict_do_update(
            index_elements=[AppConfig.namespace, AppConfig.key],
            set_={**values, "updated_at": func.now()},
        ).returning(AppConfig)
        return await self.session.scalar(statement.execution_options(populate_existing=True))

    async def upsert_flag(self, key: str, values: dict):
        statement = insert(FeatureFlag).values(key=key, **values)
        statement = statement.on_conflict_do_update(
            index_elements=[FeatureFlag.key], set_={**values, "updated_at": func.now()}
        ).returning(FeatureFlag)
        return await self.session.scalar(statement.execution_options(populate_existing=True))
