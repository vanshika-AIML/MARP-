from sqlalchemy import Column, String, Text
from database import Base
import uuid

class Presentation(Base):
    __tablename__ = "presentations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String, index=True)
    theme = Column(String, default="default")
    markdown = Column(Text, default="")
