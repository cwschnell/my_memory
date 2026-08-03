"""
Uses OpenAI Whisper API to transcribe and translate audio into English text.
Supports spoken Afrikaans and English, translating everything into clean English.
"""
import asyncio
import os
from openai import AsyncOpenAI

_client = None

def get_openai_client():
    global _client
    if _client is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY is not set in the .env file. Please add your API key to use voice features.")
        _client = AsyncOpenAI(api_key=key)
    return _client

async def transcribe_audio(audio_path: str) -> str:
    """Run transcription via OpenAI Whisper API."""
    client = get_openai_client()
    with open(audio_path, "rb") as audio_file:
        # task="translate" is handled by the 'translations' endpoint natively in OpenAI
        response = await client.audio.translations.create(
            model="whisper-1",
            file=audio_file
        )
    return response.text.strip()
