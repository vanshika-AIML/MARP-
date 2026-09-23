from pydantic import BaseModel
from typing import Optional

class PresentationBase(BaseModel):
    title: str
    theme: str = "default"
    markdown: str = ""

class PresentationCreate(PresentationBase):
    pass

class PresentationUpdate(BaseModel):
    title: Optional[str] = None
    theme: Optional[str] = None
    markdown: Optional[str] = None

class Presentation(PresentationBase):
    id: str

    class Config:
        from_attributes = True
