from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter(prefix="/agent", tags=["agent"])

client = None
if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "your_nvidia_api_key_here":
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.getenv("NVIDIA_API_KEY")
    )

class GenerateSlideRequest(BaseModel):
    prompt: str
    theme: str = "default"
    
class GenerateContentRequest(BaseModel):
    prompt: str
    context: str = ""
    theme: str = "default"

class RefineSlideRequest(BaseModel):
    slide_index: int
    instruction: str
    presentation_id: str

@router.post("/generate-slide")
def generate_slide(req: GenerateSlideRequest):
    if not client:
        return {
            "status": "success",
            "markdown": f"\n---\n## Generated Slide\n\n- {req.prompt}\n*Set NVIDIA_API_KEY for AI generation*\n"
        }
        
    prompt = f"""You are an expert presentation designer (like Gamma.app). Create a visually stunning single presentation slide in MARP Markdown about: {req.prompt}.
CRITICAL INSTRUCTIONS:
1. Use advanced MARP layout features to make the slide beautiful!
2. Use `<!-- _class: lead -->` if it's a title slide.
3. Use split layouts for visual impact (e.g., `![bg right:40%](https://images.unsplash.com/photo-...)` with real unsplash image URLs).
4. Use formatting (bold, italics, blockquotes) to make text dynamic.
5. Return ONLY the raw markdown for the slide (no frontmatter).
6. Do not wrap your response in markdown code blocks (e.g. ```). Just raw text.
"""
    try:
        res = client.chat.completions.create(
            model="meta/llama-3.2-11b-vision-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = res.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            if len(lines) > 2:
                content = "\n".join(lines[1:-1])
                
        return {"status": "success", "markdown": f"\n---\n{content}\n"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-content")
def generate_content(req: GenerateContentRequest):
    if not client:
        return {
            "status": "success",
            "markdown": f"---\nmarp: true\ntheme: {req.theme}\n---\n# Deck based on {req.prompt}\n\n*Please add NVIDIA_API_KEY in backend/.env for real AI generation.*\n"
        }

    prompt = f"""
You are an expert presentation designer, inspired by AI tools like Gamma.app.
Create a highly visual, stunning slide deck using MARP Markdown based on this topic: "{req.prompt}".
Additional Context: "{req.context}"

CRITICAL INSTRUCTIONS FOR GORGEOUS DESIGN:
1. Include at least 4 distinct slides. Separate each slide with exactly `---` on its own line.
2. DO NOT include any yaml frontmatter. Just the slides.
3. Slide 1 (Title): Must use `<!-- _class: lead -->` and have a powerful, large centered title.
4. Slide 2+ (Content): Use advanced MARP layouts! 
   - Use split image backgrounds for visual impact: `![bg right:40%](https://images.unsplash.com/photo-...)`
   - Use beautiful Unsplash URLs for images relevant to the topic.
5. Use dynamic typography: mix large headers (`#`), subheaders (`##`), bullet points, and blockquotes (`>`).
6. Do not wrap your response in markdown code blocks (e.g. ```). Just raw text.
7. DO NOT MANUALLY SET `_backgroundColor` or `_color`. The application themes will handle colors. Just use structural layouts!
"""
    try:
        res = client.chat.completions.create(
            model="meta/llama-3.2-11b-vision-instruct",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = res.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            if len(lines) > 2:
                content = "\n".join(lines[1:-1])
                
        final_markdown = f"---\nmarp: true\ntheme: {req.theme}\n---\n\n{content}"
        return {"status": "success", "markdown": final_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/refine-slide")
def refine_slide(req: RefineSlideRequest):
    return {
        "status": "success",
        "refinedMarkdown": f"\n<!-- _class: lead -->\n## Refined Slide ({req.instruction})\n"
    }

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    return {
        "task_id": task_id,
        "status": "completed",
        "progress": 100
    }
