from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter()

client = None
if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "your_nvidia_api_key_here":
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=os.getenv("NVIDIA_API_KEY")
    )

@router.websocket("/ws/generation")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("action") == "generate":
                    payload = message.get("payload", {})
                    prompt = payload.get("prompt", "")
                    theme = payload.get("theme", "default")
                    
                    await websocket.send_json({"type": "generating", "progress": 10, "message": "Analyzing..."})
                    
                    if not client:
                        await asyncio.sleep(1)
                        await websocket.send_json({"type": "completed", "progress": 100, "message": "Done!", "payload": {"markdown": f"---\nmarp: true\ntheme: {theme}\n---\n# Deck based on {prompt}\n\n*Please add NVIDIA_API_KEY in backend/.env for real AI generation.*\n"}})
                        continue

                    sys_prompt = f"""You are an expert presentation designer. Create a slide deck using MARP Markdown based on this topic: "{prompt}".
Return ONLY valid MARP Markdown.
Start with:
---
marp: true
theme: {theme}
---

Include at least 4 slides. Use headers, lists, and bold text. Separate slides with ---.
"""
                    
                    await websocket.send_json({"type": "generating_slide", "progress": 40, "slideIndex": 1, "message": "Drafting slides with AI..."})
                    
                    res = await asyncio.to_thread(
                        client.chat.completions.create,
                        model="meta/llama-3.2-11b-vision-instruct",
                        messages=[{"role": "user", "content": sys_prompt}],
                        temperature=0.7
                    )

                    await websocket.send_json({"type": "rendering", "progress": 90, "message": "Rendering..."})
                    await websocket.send_json({"type": "completed", "progress": 100, "message": "Done!", "payload": {"markdown": res.choices[0].message.content}})
            except json.JSONDecodeError:
                pass
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})
    except WebSocketDisconnect:
        print("Client disconnected")
