from pathlib import Path
import os

from dotenv import load_dotenv
from groq import Groq

path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=path)
API_KEY = (os.getenv("GROQ_API_KEY") or "").strip()

if not API_KEY:
    raise RuntimeError("GROQ_API_KEY ausente. Configure backend/.env antes de usar o chat IA.")

client = Groq(api_key=API_KEY, timeout=30.0, max_retries=1)


def ask(txt, ido):
    completion = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": f"'{txt}'. Responda em {ido}",
            }
        ],
    )
    return completion.choices[0].message.content