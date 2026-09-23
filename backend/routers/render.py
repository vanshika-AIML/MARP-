from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/render", tags=["render"])

class RenderRequest(BaseModel):
    markdown: str
    
@router.post("/preview")
def render_preview(request: RenderRequest):
    # Mocking MARP preview for now. Ideally this calls npx @marp-team/marp-cli
    return {"html": f"<div class='mock-render'>{request.markdown}</div>"}
