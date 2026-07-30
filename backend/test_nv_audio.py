import httpx
import sys
import os

NVIDIA_API_KEY = "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"
URL = "https://integrate.api.nvidia.com/v1/audio/transcriptions"

# create a dummy audio file
with open("test.wav", "wb") as f:
    f.write(b"RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

headers = {
    "Authorization": f"Bearer {NVIDIA_API_KEY}"
}
files = {
    "file": ("test.wav", open("test.wav", "rb"), "audio/wav")
}
data = {
    "model": "nvidia/canary" # Guessing model name, or maybe openai/whisper-large-v3
}

try:
    res = httpx.post(URL, headers=headers, files=files, data=data)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Error:", e)
