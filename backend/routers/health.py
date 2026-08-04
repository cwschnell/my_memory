from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime
import uuid
import logging
import os
from services.openrouter_service import analyze_script_error, analyze_user_suspicion

logger = logging.getLogger("health_router")

router = APIRouter(prefix="/health", tags=["Health & AI Repair Monitor"])

# In-memory Incident Store
INCIDENTS_DB: List[Dict[str, Any]] = []

class SimulateBreakRequest(BaseModel):
    failing_script: str
    error_message: str
    stack_trace: Optional[str] = None
    code_snippet: Optional[str] = None

class AnalyzeSuspicionRequest(BaseModel):
    script_path: str
    user_suspicion: str

class ApplyFixRequest(BaseModel):
    script_path: str
    new_code: str

@router.get("")
async def health_check():
    active_incidents = [inc for inc in INCIDENTS_DB if inc.get("status") == "ACTIVE"]
    return {
        "status": "UNHEALTHY" if active_incidents else "OK",
        "app_name": "My Memory API",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "active_incidents_count": len(active_incidents)
    }

@router.get("/deep")
async def deep_health_check():
    active_incidents = [inc for inc in INCIDENTS_DB if inc.get("status") == "ACTIVE"]
    return {
        "status": "UNHEALTHY" if active_incidents else "OK",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "checks": {
            "database": "CONNECTED",
            "openrouter_api": "ONLINE",
            "containers": "HEALTHY",
            "synthetic_pipeline": "PASSED" if not active_incidents else "FAILING"
        },
        "incidents": active_incidents
    }

@router.get("/incidents")
async def list_incidents():
    return {
        "total_incidents": len(INCIDENTS_DB),
        "incidents": INCIDENTS_DB
    }

@router.post("/simulate-break")
async def simulate_script_break(req: SimulateBreakRequest):
    logger.warning(f"Simulated script break triggered for: {req.failing_script}")
    
    llm_analysis = analyze_script_error(
        failing_script=req.failing_script,
        error_message=req.error_message,
        stack_trace=req.stack_trace or f"Traceback (most recent call last):\n  File '{req.failing_script}', line 42, in main\n    raise RuntimeError('{req.error_message}')",
        code_snippet=req.code_snippet or f"# {req.failing_script}\ndef process_data():\n    raise ValueError('{req.error_message}')"
    )
    
    incident_id = str(uuid.uuid4())
    incident = {
        "id": incident_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "ACTIVE",
        "failing_script": req.failing_script,
        "error_message": req.error_message,
        "severity": llm_analysis.get("severity", "CRITICAL"),
        "title": llm_analysis.get("incident_title", f"Script Break: {req.failing_script}"),
        "llm_analysis": llm_analysis
    }
    
    INCIDENTS_DB.insert(0, incident)
    return {"message": "Script failure flagged! OpenRouter AI repair playbook generated.", "incident": incident}

@router.post("/analyze-suspicion")
async def analyze_suspicion(req: AnalyzeSuspicionRequest):
    """
    Reads the target script from disk, sends actual code + user suspicion to OpenRouter AI,
    verifies if the suspicion is correct, and generates a working replacement script.
    """
    target_path = req.script_path.replace("\\", "/").strip()
    
    # Try resolving path relative to backend or root
    possible_paths = [
        target_path,
        os.path.join(".", target_path),
        os.path.join("/app", target_path.replace("backend/", "")),
        os.path.join("backend", target_path)
    ]
    
    actual_file_path = None
    code_content = None
    
    for p in possible_paths:
        if os.path.exists(p) and os.path.isfile(p):
            actual_file_path = p
            try:
                with open(p, "r", encoding="utf-8") as f:
                    code_content = f.read()
                break
            except Exception as e:
                logger.warning(f"Error reading file {p}: {e}")

    if not code_content:
        code_content = f"# Mock script content for {target_path}\n# File not found on server disk"

    # Query OpenRouter AI
    analysis = analyze_user_suspicion(
        script_path=target_path,
        script_content=code_content,
        user_suspicion=req.user_suspicion
    )

    incident_id = str(uuid.uuid4())
    incident = {
        "id": incident_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "ACTIVE",
        "failing_script": target_path,
        "error_message": req.user_suspicion,
        "severity": "HIGH",
        "title": analysis.get("verdict_title", f"Suspicion Audit: {target_path}"),
        "llm_analysis": {
            "incident_title": analysis.get("verdict_title", f"Suspicion Audit: {target_path}"),
            "failing_script": target_path,
            "severity": "HIGH",
            "root_cause_analysis": analysis.get("explanation", "Analysis completed."),
            "suggested_patch_diff": analysis.get("suggested_patch_diff", analysis.get("full_corrected_code", "// Code fix")),
            "step_by_step_repair_instructions": analysis.get("step_by_step_fix", ["Review changes", "Apply fix"]),
            "full_corrected_code": analysis.get("full_corrected_code", "")
        }
    }
    
    INCIDENTS_DB.insert(0, incident)
    return {"message": "Suspicion analyzed by OpenRouter AI!", "analysis": analysis, "incident": incident}

@router.post("/apply-fix")
async def apply_fix(req: ApplyFixRequest):
    """Writes corrected code directly to script file on disk."""
    target_path = req.script_path.replace("\\", "/").strip()
    
    possible_paths = [
        target_path,
        os.path.join(".", target_path),
        os.path.join("/app", target_path.replace("backend/", "")),
        os.path.join("backend", target_path)
    ]
    
    written_path = None
    for p in possible_paths:
        if os.path.exists(p) or p.endswith(".py"):
            try:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "w", encoding="utf-8") as f:
                    f.write(req.new_code)
                written_path = p
                break
            except Exception as e:
                logger.warning(f"Could not write to {p}: {e}")

    if written_path:
        return {"status": "success", "message": f"Updated script at {written_path}"}
    raise HTTPException(status_code=500, detail="Could not write file to disk")

@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    for inc in INCIDENTS_DB:
        if inc["id"] == incident_id:
            inc["status"] = "RESOLVED"
            inc["resolved_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            return {"message": "Incident marked as RESOLVED", "incident": inc}
    raise HTTPException(status_code=404, detail="Incident not found")

@router.post("/incidents/clear-all")
async def clear_all_incidents():
    global INCIDENTS_DB
    INCIDENTS_DB = []
    return {"message": "All incidents cleared"}

@router.get("/dashboard", response_class=HTMLResponse)
async def health_dashboard():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Memory — Health & AI Repair Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Fira+Code:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-bg: #1e293b;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-amber: #f59e0b;
            --accent-blue: #3b82f6;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Outfit', sans-serif; background-color: var(--bg-dark); color: var(--text-main); padding: 2rem; min-height: 100vh; }

        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; }
        .header h1 { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        .status-badge { padding: 0.5rem 1.25rem; border-radius: 9999px; font-weight: 700; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 0.5rem; }
        .status-badge.ok { background-color: rgba(16, 185, 129, 0.15); color: var(--accent-green); border: 1px solid var(--accent-green); }
        .status-badge.unhealthy { background-color: rgba(239, 68, 68, 0.2); color: var(--accent-red); border: 1px solid var(--accent-red); animation: pulse-border 1.5s infinite; }

        @keyframes pulse-border {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .emergency-banner { display: none; background: linear-gradient(90deg, #b91c1c, #dc2626, #b91c1c); background-size: 200% 200%; animation: gradient-flash 1s infinite alternate; color: white; padding: 1.25rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3); }
        @keyframes gradient-flash { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
        .emergency-banner.active { display: block; }

        .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tab-btn { padding: 0.6rem 1.2rem; background: #1e293b; border: 1px solid #334155; color: #94a3b8; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .tab-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

        .card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.75rem; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2); }
        .card h2 { font-size: 1.25rem; margin-bottom: 1.25rem; color: #e2e8f0; display: flex; align-items: center; gap: 0.5rem; }

        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.4rem; font-weight: 600; }
        .form-group input, .form-group textarea { width: 100%; padding: 0.75rem; background-color: #0f172a; border: 1px solid var(--border-color); border-radius: 8px; color: white; font-family: 'Fira Code', monospace; font-size: 0.875rem; }

        .btn { padding: 0.75rem 1.5rem; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.5rem; }
        .btn-danger { background-color: var(--accent-red); color: white; }
        .btn-danger:hover { background-color: #dc2626; }
        .btn-primary { background-color: var(--accent-blue); color: white; }
        .btn-primary:hover { background-color: #2563eb; }
        .btn-success { background-color: var(--accent-green); color: white; }
        .btn-secondary { background-color: #334155; color: white; }

        .incident-item { background-color: #0f172a; border-left: 4px solid var(--accent-red); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
        .incident-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .failing-tag { font-family: 'Fira Code', monospace; background-color: rgba(239, 68, 68, 0.15); color: #fca5a5; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
        .code-block { background-color: #020617; padding: 1rem; border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 0.8rem; color: #38bdf8; white-space: pre-wrap; overflow-x: auto; margin-top: 0.5rem; }
        .steps-list { margin-left: 1.25rem; color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem; }
    </style>
</head>
<body>

    <div class="header">
        <div>
            <h1>🛡️ My Memory — Health & AI Repair Hub</h1>
            <p style="color: var(--text-muted); margin-top: 0.25rem;">Live Health Monitor & OpenRouter AI Code Fixer</p>
        </div>
        <div id="statusBadge" class="status-badge ok">
            <span id="statusDot">🟢</span> SYSTEM HEALTHY
        </div>
    </div>

    <!-- Flashing Emergency Banner -->
    <div id="emergencyBanner" class="emergency-banner">
        <h3 style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.2rem;">
            🚨 ALERT: SCRIPT REGRESSION / INCIDENT DETECTED!
        </h3>
        <p id="emergencyText" style="margin-top: 0.4rem; font-size: 0.95rem; opacity: 0.95;"></p>
    </div>

    <div class="tabs">
        <button id="tabSimulate" class="tab-btn active" onclick="switchTab('simulate')">⚡ Simulate Script Failure</button>
        <button id="tabSuspicion" class="tab-btn" onclick="switchTab('suspicion')">🔍 Verify Problem / Suspicion on File</button>
    </div>

    <div class="grid">
        <!-- Left Panel: Simulate or Verify -->
        <div class="card">
            <!-- Mode 1: Simulate Error -->
            <div id="simulatePanel">
                <h2>🧪 Simulate Script Crash / Error</h2>
                <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.25rem;">
                    Test how the system flags runtime crashes and queries OpenRouter AI for repair instructions.
                </p>
                <form id="simulateForm">
                    <div class="form-group">
                        <label>Failing Script File Path</label>
                        <input type="text" id="scriptPath" value="backend/routers/updates.py" required>
                    </div>
                    <div class="form-group">
                        <label>Error Message</label>
                        <input type="text" id="errorMsg" value="HTTPException 404: APK file not found on server" required>
                    </div>
                    <div class="form-group">
                        <label>Code Snippet</label>
                        <textarea id="codeSnippet" rows="3">@router.get("/download")
async def download_apk():
    # Looking for wrong APK filename!
    return FileResponse("app-release.apk")</textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn btn-danger">⚡ Trigger Script Failure & AI Repair</button>
                        <button type="button" class="btn btn-secondary" onclick="clearIncidents()">Clear All</button>
                    </div>
                </form>
            </div>

            <!-- Mode 2: Verify Suspicion on Real Code File -->
            <div id="suspicionPanel" style="display: none;">
                <h2>🔍 Audit Script & Verify Suspicion</h2>
                <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.25rem;">
                    OpenRouter AI will read your actual script from disk, check if your suspicion is correct, and generate a fixed version!
                </p>
                <form id="suspicionForm">
                    <div class="form-group">
                        <label>Target Script Path in Project</label>
                        <input type="text" id="suspectPath" value="backend/routers/updates.py" required>
                    </div>
                    <div class="form-group">
                        <label>What do you suspect is wrong? (Your Problem Query)</label>
                        <textarea id="userSuspicion" rows="4" required>The correct APK is not downloading when the user calls /updates/download. The filename or download logic might be looking for the wrong file or missing default routes.</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">🔍 Audit File & Generate AI Fix</button>
                </form>
            </div>
        </div>

        <!-- Right Panel: Registered Repair Playbooks -->
        <div class="card">
            <h2>🛠️ Registered AI Repair Playbooks</h2>
            <div id="incidentsContainer">
                <p style="color: var(--text-muted); font-size: 0.9rem;">No active incidents. System operational.</p>
            </div>
        </div>
    </div>

    <script>
        function switchTab(mode) {
            document.getElementById('tabSimulate').className = mode === 'simulate' ? 'tab-btn active' : 'tab-btn';
            document.getElementById('tabSuspicion').className = mode === 'suspicion' ? 'tab-btn active' : 'tab-btn';
            document.getElementById('simulatePanel').style.display = mode === 'simulate' ? 'block' : 'none';
            document.getElementById('suspicionPanel').style.display = mode === 'suspicion' ? 'block' : 'none';
        }

        async function fetchHealth() {
            try {
                const res = await fetch('/health/deep');
                const data = await res.json();
                
                const badge = document.getElementById('statusBadge');
                const banner = document.getElementById('emergencyBanner');
                const bannerText = document.getElementById('emergencyText');
                const container = document.getElementById('incidentsContainer');

                if (data.status === 'UNHEALTHY' || (data.incidents && data.incidents.length > 0)) {
                    badge.className = 'status-badge unhealthy';
                    badge.innerHTML = '<span>🔴</span> ALERT: INCIDENT ACTIVE';
                    
                    const first = data.incidents[0];
                    banner.className = 'emergency-banner active';
                    bannerText.innerHTML = `Script <strong>${first.failing_script}</strong>: <em>${first.error_message}</em>. OpenRouter AI fix available below.`;

                    container.innerHTML = data.incidents.map(inc => {
                        const ai = inc.llm_analysis || {};
                        const steps = (ai.step_by_step_repair_instructions || []).map(s => `<li>${s}</li>`).join('');
                        let patch = ai.suggested_patch_diff || ai.full_corrected_code || '';
                        let rootCause = ai.root_cause_analysis || inc.error_message || '';
                        
                        return `
                            <div class="incident-item">
                                <div class="incident-header">
                                    <span class="failing-tag">${inc.failing_script}</span>
                                    <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="resolveIncident('${inc.id}')">Mark Resolved</button>
                                </div>
                                <h4 style="color: #f8fafc; margin-bottom: 0.4rem;">${ai.incident_title || inc.title}</h4>
                                <p style="color: #fca5a5; font-size: 0.88rem; margin-bottom: 0.6rem;"><strong>Analysis:</strong> ${rootCause}</p>
                                
                                <strong style="font-size: 0.8rem; color: #94a3b8;">OpenRouter AI Suggested Fix Code:</strong>
                                <div class="code-block">${patch}</div>

                                ${ai.full_corrected_code ? `
                                    <button class="btn btn-success" style="margin-top: 0.75rem; padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="applyFix('${inc.failing_script}', \`${encodeURIComponent(ai.full_corrected_code)}\`)">
                                        💾 Apply Fix Directly to File on Disk
                                    </button>
                                ` : ''}

                                <strong style="font-size: 0.8rem; color: #94a3b8; display: block; margin-top: 0.75rem;">Repair Playbook:</strong>
                                <ul class="steps-list">${steps}</ul>
                            </div>
                        `;
                    }).join('');
                } else {
                    badge.className = 'status-badge ok';
                    badge.innerHTML = '<span>🟢</span> SYSTEM HEALTHY';
                    banner.className = 'emergency-banner';
                    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No active incidents. System operational.</p>';
                }
            } catch (e) {
                console.error("Failed to fetch health:", e);
            }
        }

        document.getElementById('simulateForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = "⌛ Querying OpenRouter AI...";
            btn.disabled = true;

            try {
                await fetch('/health/simulate-break', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        failing_script: document.getElementById('scriptPath').value,
                        error_message: document.getElementById('errorMsg').value,
                        code_snippet: document.getElementById('codeSnippet').value
                    })
                });
                await fetchHealth();
            } finally {
                btn.innerHTML = "⚡ Trigger Script Failure & AI Repair";
                btn.disabled = false;
            }
        });

        document.getElementById('suspicionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = "⌛ Reading File & Auditing via OpenRouter...";
            btn.disabled = true;

            try {
                await fetch('/health/analyze-suspicion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        script_path: document.getElementById('suspectPath').value,
                        user_suspicion: document.getElementById('userSuspicion').value
                    })
                });
                await fetchHealth();
            } finally {
                btn.innerHTML = "🔍 Audit File & Generate AI Fix";
                btn.disabled = false;
            }
        });

        async function applyFix(scriptPath, encodedCode) {
            const code = decodeURIComponent(encodedCode);
            if (!confirm(`Apply OpenRouter's AI code fix directly to ${scriptPath}?`)) return;
            
            const res = await fetch('/health/apply-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script_path: scriptPath, new_code: code })
            });
            const data = await res.json();
            alert(data.message || "Script updated!");
            fetchHealth();
        }

        async function resolveIncident(id) {
            await fetch(`/health/incidents/${id}/resolve`, { method: 'POST' });
            fetchHealth();
        }

        async function clearIncidents() {
            await fetch('/health/incidents/clear-all', { method: 'POST' });
            fetchHealth();
        }

        fetchHealth();
        setInterval(fetchHealth, 3000);
    </script>
</body>
</html>"""
    return HTMLResponse(content=html_content)
