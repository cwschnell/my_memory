"""
Uses NVIDIA NIM to summarise memos and categorize/translate shopping items.
"""
import os
import re
import json
import httpx

NVIDIA_API_KEY = os.getenv("NVIDIA-KEY") or os.getenv("NVIDIA_API_KEY")
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

CATEGORIES = [
    "Vegetables", "Groceries", "Meat", "Dairy", "Grain", 
    "Electrical", "Hardware", "Fuel", "Spare Parts", "Paint", "Tools"
]

async def summarise_to_three_words(transcript: str) -> str:
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

    # Fallback: extract first 3 words directly from transcript if NIM fails/no key
    words = re.findall(r'\b[A-Za-z0-9]+\b', transcript)
    if len(words) >= 3:
        return " ".join(words[:3]).title()
    elif len(words) > 0:
        return " ".join(words).title()
    return "New Voice Memo"


async def extract_shopping_items(transcript: str) -> list[str]:
    """
    Extracts individual product names from a shopping transcript into a flat list of strings.
    Translates non-English words to English.
    Example return: ["Apples", "Tomatoes", "Hammer"]
    """
    prompt = (
        "You are an intelligent shopping list assistant. Extract all distinct shopping/product items mentioned in the following transcript.\n"
        "1. Translate any Afrikaans or non-English words into clean English.\n"
        "2. Capitalize each item cleanly (e.g., 'Apples', 'Fresh Tomatoes', 'Hammer').\n"
        "3. Do NOT include any categories, store names, or bullet points.\n"
        "Return ONLY a raw JSON array of strings. Example: [\"Apples\", \"Tomatoes\", \"Hammer\"]"
    )

    # 1. Try NVIDIA API if key exists
    if NVIDIA_API_KEY:
        payload = {
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Transcript: {transcript}"}
            ],
            "temperature": 0.1,
            "max_tokens": 150
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
                    if raw.startswith("```json"): raw = raw[7:]
                    if raw.startswith("```"): raw = raw[3:]
                    if raw.endswith("```"): raw = raw[:-3]
                    items = json.loads(raw.strip())
                    if isinstance(items, list) and len(items) > 0:
                        return [str(it).strip() for it in items if str(it).strip()]
        except Exception as e:
            print(f"NVIDIA extract_shopping_items error: {e}")

    # 2. Try OpenAI API if key exists
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            from openai import AsyncOpenAI
            oa_client = AsyncOpenAI(api_key=openai_key)
            res = await oa_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Transcript: {transcript}"}
                ],
                temperature=0.1,
                max_tokens=150
            )
            raw = res.choices[0].message.content.strip()
            if raw.startswith("```json"): raw = raw[7:]
            if raw.startswith("```"): raw = raw[3:]
            if raw.endswith("```"): raw = raw[:-3]
            items = json.loads(raw.strip())
            if isinstance(items, list) and len(items) > 0:
                return [str(it).strip() for it in items if str(it).strip()]
        except Exception as e:
            print(f"OpenAI extract_shopping_items error: {e}")

    # Fallback: simple regex splitting on commas/and/newlines
    cleaned = re.sub(r'\b(and|buy|get|need|please)\b', ',', transcript, flags=re.IGNORECASE)
    parts = [p.strip().title() for p in cleaned.split(',') if p.strip()]
    return parts if parts else [transcript.strip().title()]


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

async def clean_transcript(transcript: str) -> str:
    """
    Uses LLM to clean up spelling, grammar, and gibberish words in the transcript, 
    preserving the original meaning and structure.
    """
    if NVIDIA_API_KEY:
        prompt = (
            "You are a helpful assistant. Please fix the spelling, grammar, and any gibberish words "
            "in the following voice transcript. Keep the original language and meaning exactly the same, "
            "only fixing errors. Do not add any conversational text or explanations. Return ONLY the cleaned transcript."
        )
        payload = {
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": transcript}
            ],
            "temperature": 0.1,
            "max_tokens": 500
        }
        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(NVIDIA_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    raw = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    return raw
        except Exception as e:
            print(f"NVIDIA clean transcript error: {e}")
            
    # Fallback: return as-is
    return transcript

