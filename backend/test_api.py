import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

models_to_test = [
    "google/gemma-2-9b-it",
    "google/gemma-2-27b-it",
    "google/gemma-7b-it"
]

for model in models_to_test:
    try:
        print(f"Testing model: {model}...")
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello world!"}],
            temperature=0.7
        )
        print("Success! Response:")
        print(res.choices[0].message.content)
        break
    except Exception as e:
        print(f"Error for {model}: {e}")

