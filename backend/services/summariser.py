"""
Uses NVIDIA NIM (or local Ollama fallback) to summarise memos and categorize/translate shopping items.
"""
import os
import re
import json
import httpx

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")

NVIDIA_API_KEY = os.getenv("NVIDIA-KEY") or os.getenv("NVIDIA_API_KEY")
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

CATEGORIES = [
    "Vegetables", "Groceries", "Meat", "Dairy", "Grain", 
    "Electrical", "Hardware", "Fuel", "Spare Parts", "Paint", "Tools"
]

async def summarise_to_three_words(transcript: str) -> str:
    # Try NVIDIA NIM first if key is available
    if NVIDIA_API_KEY:
        try:
            payload = {
                "model": "meta/llama-3.1-8b-instruct",
                "messages": [
                    {
                        "role": "system", 
                        "content": "You are a memory assistant. Your ONLY job is to summarise the voice transcript into EXACTLY 3 words in English. No punctuation. No explanation. Just 3 words."
                    },
                    {"role": "user", "content": f"Transcript: {transcript}\n\n3-word summary:"}
                ],
                "temperature": 0.2,
                "max_tokens": 20
            }
            headers = {
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(NVIDIA_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    raw = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    words = re.findall(r'\b[A-Za-z0-9]+\b', raw)
                    if len(words) >= 3:
                        return " ".join(words[:3]).title()
                    elif len(words) > 0:
                        return " ".join(words).title()
        except Exception as e:
            print(f"NVIDIA summarisation error: {e}")

    # Fallback to Ollama
    url = f"{OLLAMA_HOST}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"Summarise into EXACTLY 3 words in English without punctuation:\n\nTranscript: {transcript}\n\n3-word summary:",
        "stream": False,
        "options": {"temperature": 0.2, "max_tokens": 20}
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                raw = res.json().get("response", "").strip()
                words = re.findall(r'\b[A-Za-z0-9]+\b', raw)
                if len(words) >= 3:
                    return " ".join(words[:3]).title()
                elif len(words) > 0:
                    return " ".join(words).title()
    except Exception as e:
        print(f"Ollama summarisation error: {e}")

    # Fallback: extract first 3 words directly from transcript
    words = re.findall(r'\b[A-Za-z0-9]+\b', transcript)
    if len(words) >= 3:
        return " ".join(words[:3]).title()
    elif len(words) > 0:
        return " ".join(words).title()
    return "New Voice Memo"


async def categorize_shopping_item(transcript: str) -> dict:
    """
    Translates Afrikaans/other languages into English and categorizes into the 11 shopping categories.
    Returns: {'item_name': '...', 'category': '...'}
    """
    if NVIDIA_API_KEY:
        prompt = (
            "You are an intelligent shopping assistant. Analyze the following shopping voice memo or text.\n"
            "1. Translate any Afrikaans words into clean English.\n"
            "2. Extract a concise, readable English item name or list of items.\n"
            f"3. Classify into EXACTLY ONE of these categories: {', '.join(CATEGORIES)}. If unsure or general food, choose 'Groceries'.\n"
            "Return ONLY a JSON object with keys \"item_name\" and \"category\". Example: {\"item_name\": \"Fresh Milk & Cheese\", \"category\": \"Dairy\"}"
        )
        payload = {
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Transcript: {transcript}"}
            ],
            "temperature": 0.1,
            "max_tokens": 60
        }
        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(NVIDIA_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    raw = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if raw.startswith("```json"):
                        raw = raw[7:]
                    if raw.endswith("```"):
                        raw = raw[:-3]
                    data = json.loads(raw.strip())
                    cat = data.get("category", "Groceries")
                    if cat not in CATEGORIES:
                        cat = "Groceries"
                    return {"item_name": data.get("item_name", transcript[:50]).strip(), "category": cat}
        except Exception as e:
            print(f"NVIDIA shopping categorization error: {e}")

    # Fallback if NVIDIA fails or key missing
    words = re.findall(r'\b[A-Za-z0-9]+\b', transcript)
    summary = " ".join(words[:6]).title() if words else "Shopping Item"
    return {"item_name": summary, "category": "Groceries"}
