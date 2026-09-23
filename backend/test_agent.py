import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

prompt = """
You are an expert presentation designer, inspired by AI tools like Gamma.app.
Create a highly visual, stunning slide deck using MARP Markdown based on this topic: "Q3 Product Roadmap Review".
Additional Context: "None"

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

res = client.chat.completions.create(
    model="meta/llama-3.2-11b-vision-instruct",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.7
)

print(res.choices[0].message.content)
