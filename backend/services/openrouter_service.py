import os
import json
import logging
import urllib.request
from typing import Dict, Any

logger = logging.getLogger("openrouter_service")

DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "cohere/north-mini-code:free")

def get_openrouter_api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY")
    if key:
        return key.strip()
    
    possible_paths = [
        "docs/secrets/openrouter.txt",
        "../docs/secrets/openrouter.txt",
        "C:/Users/Andrisa/Documents/Projects/mem_assist/docs/secrets/openrouter.txt"
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content.startswith("sk-or-"):
                        return content
            except Exception as e:
                logger.warning(f"Failed to read key from {path}: {e}")
    
    return os.getenv("OPENROUTER_API_KEY", "")

def analyze_script_error(failing_script: str, error_message: str, stack_trace: str, code_snippet: str = "") -> Dict[str, Any]:
    api_key = get_openrouter_api_key()
    if not api_key:
        return {
            "error": "No OpenRouter API key found.",
            "status": "failed"
        }
    
    prompt = f"""You are an expert Reliability Engineer AI. An application script threw a runtime error.
Analyze the following details and provide a structured JSON repair report.

Failing Script: {failing_script}
Error Message: {error_message}
Stack Trace:
{stack_trace}

Code Snippet (if available):
{code_snippet}

Output ONLY raw JSON with these exact keys:
{{
  "incident_title": "Short descriptive title of what broke",
  "failing_script": "{failing_script}",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM",
  "root_cause_analysis": "Detailed explanation of why the script broke",
  "suggested_patch_diff": "Git diff style patch or code snippet to fix the issue",
  "step_by_step_repair_instructions": ["Step 1...", "Step 2...", "Step 3..."]
}}
"""

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful software reliability engineer AI. Respond ONLY in valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            content = response_data["choices"][0]["message"]["content"]
            
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            try:
                parsed_result = json.loads(content)
                parsed_result["status"] = "success"
                return parsed_result
            except Exception:
                return {
                    "status": "success",
                    "incident_title": f"Script Failure in {failing_script}",
                    "failing_script": failing_script,
                    "severity": "HIGH",
                    "root_cause_analysis": content,
                    "suggested_patch_diff": "// Inspect code snippet and error trace above",
                    "step_by_step_repair_instructions": [
                        f"1. Review failing script: {failing_script}",
                        f"2. Fix error: {error_message}",
                        "3. Restart local container"
                    ]
                }
    except Exception as e:
        logger.error(f"OpenRouter API call failed: {e}")
        return {
            "status": "error",
            "incident_title": f"Script Failure in {failing_script}",
            "failing_script": failing_script,
            "severity": "HIGH",
            "root_cause_analysis": f"Error calling OpenRouter API: {str(e)}",
            "suggested_patch_diff": "// OpenRouter API call failed",
            "step_by_step_repair_instructions": [
                "1. Check internet connection and OpenRouter API status",
                f"2. Inspect error: {error_message}"
            ]
        }

def analyze_user_suspicion(script_path: str, script_content: str, user_suspicion: str) -> Dict[str, Any]:
    """
    Analyzes a user's suspicion or problem statement against a specific script file's actual code.
    Verifies if suspicion is accurate, explains the issue, and provides a full updated replacement code block.
    """
    api_key = get_openrouter_api_key()
    if not api_key:
        return {"status": "error", "error": "No OpenRouter API key found."}

    prompt = f"""You are a Senior Python & Fast API Code Reviewer.
The developer suspects there is a problem with the following script: '{script_path}'.

User's Suspicion / Problem Query:
"{user_suspicion}"

Actual Script Code ({script_path}):
```python
{script_content}
```

Instructions:
1. Determine if the user's suspicion is CORRECT or INCORRECT.
2. Explain the exact bug, logical flaw, missing file path, or issue in detail.
3. Provide the full corrected code for the script or relevant function.

Output ONLY raw JSON with these exact keys:
{{
  "suspicion_confirmed": true | false,
  "verdict_title": "Short title (e.g., 'Suspicion Confirmed: File path mismatch in APK download')",
  "explanation": "Detailed explanation of whether suspicion is correct and why",
  "full_corrected_code": "Complete working python code for the script or function",
  "suggested_patch_diff": "Git diff style patch showing exact lines changed",
  "step_by_step_fix": ["Step 1...", "Step 2..."]
}}
"""

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are an expert Python AI code auditor. Respond ONLY in valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            content = response_data["choices"][0]["message"]["content"]

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            try:
                parsed = json.loads(content)
                parsed["status"] = "success"
                return parsed
            except Exception:
                return {
                    "status": "success",
                    "suspicion_confirmed": True,
                    "verdict_title": f"Analysis for {script_path}",
                    "explanation": content,
                    "full_corrected_code": script_content,
                    "suggested_patch_diff": "// See explanation above",
                    "step_by_step_fix": ["Inspect the script", "Apply suggested fixes"]
                }
    except Exception as e:
        logger.error(f"OpenRouter suspicion analysis failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
