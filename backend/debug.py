import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

prompt = """You are an expert presentation designer (like Gamma.app). Create a visually stunning single presentation slide in MARP Markdown about: API Gateway vs Service Mesh.
CRITICAL INSTRUCTIONS:
1. Use advanced MARP layout features to make the slide beautiful!
2. Use `<!-- _class: lead -->` if it's a title slide.
3. Use split layouts for visual impact (e.g., `![bg right:40%](https://images.unsplash.com/photo-...)` with real unsplash image URLs).
4. Use formatting (bold, italics, blockquotes) to make text dynamic.
5. Return ONLY the raw markdown for the slide (no frontmatter).
6. Do not wrap your response in markdown code blocks (e.g. ```). Just raw text.
"""
print("Sending request...")
try:
    res = client.chat.completions.create(
        model="meta/llama-3.2-11b-vision-instruct",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    print("Response:")
    print(repr(res.choices[0].message.content))
except Exception as e:
    print("Error:", e)
