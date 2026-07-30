import httpx

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_API_KEY = "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"

payload = {
    "model": "meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Test"}],
    "max_tokens": 5
}
headers = {
    "Authorization": f"Bearer {NVIDIA_API_KEY}",
    "Content-Type": "application/json"
}

try:
    res = httpx.post(NVIDIA_URL, json=payload, headers=headers)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Error:", e)
