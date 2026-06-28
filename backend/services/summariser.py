"""
Uses local Ollama container to summarise a transcript into exactly 3 words.
"""
import os
import re
import httpx

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")

SYSTEM_PROMPT = (
    "You are a memory assistant. The user gives you a voice note transcript. "
    "Your ONLY job is to summarise it into EXACTLY 3 words — no more, no less. "
    "No punctuation. No explanation. Just 3 words. Example: 'Buy milk tomorrow'"
)

async def summarise_to_three_words(transcript: str) -> str:
    url = f"{OLLAMA_HOST}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\nTranscript: {transcript}\n\n3-word summary:",
        "stream": False,
        "options": {
            "temperature": 0.2,
            "max_tokens": 20
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                raw = res.json().get("response", "").strip()
                words = re.findall(r'\b\w+\b', raw)
                if len(words) >= 3:
                    return " ".join(words[:3]).title()
                elif len(words) > 0:
                    return " ".join(words).title()
            return "Voice Memo Created"
    except Exception as e:
        print(f"Ollama summarisation error: {e}")
        # Fallback summary from transcript words if Ollama is not ready
        words = re.findall(r'\b\w+\b', transcript)
        if len(words) >= 3:
            return " ".join(words[:3]).title()
        return "Voice Note Summary"
