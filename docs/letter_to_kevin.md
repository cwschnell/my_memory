# Letter to Kevin: Turning Your Mac Pro Into an Internet Demo Server with ngrok

---

Hey Kevin,

Hope you're doing great! 

I wanted to share a super handy workflow with you. Since you're building awesome applications and using AI coding assistants like **Claude Code** and **Antigravity**, there comes a point where you want to show off a live demonstration of what you've built to clients, friends, or teammates without having to deploy to AWS, Vercel, or Heroku every time you make a small change.

You can actually turn your **Mac Pro** into a secure internet server in seconds using a tool called **ngrok**. It creates a secure tunnel from the public internet directly to your local development port (like `3000`, `5173`, or `8000`). Best of all, because you use Claude Code and Antigravity, you don't even need to set this up manually!

Below is a prompt/instruction block formatted specifically for AI agents. You can literally copy the section below, paste it into **Claude Code** or **Antigravity** on your Mac Pro, and let your agent do the setup and execution for you.

Enjoy building and showcasing!

---

# 🤖 AGENT EXECUTION PROMPT (Copy below and paste into Claude Code or Antigravity)

> **Target Harness:** Claude Code / Antigravity (macOS Environment)  
> **Task:** Install, configure, and launch `ngrok` on macOS to expose a local development server to the public internet.

## Phase 1: Environment Check & Installation

1. Check if `ngrok` is already installed on this Mac Pro by running:
   ```bash
   which ngrok || brew install ngrok/ngrok/ngrok
   ```
   *(If Homebrew is not installed or the brew command fails, install ngrok via cask: `brew install --cask ngrok` or guide the user to install Homebrew).*

2. Verify installation:
   ```bash
   ngrok version
   ```

## Phase 2: Authentication Check

1. Check if an authtoken is already configured by inspecting `~/.config/ngrok/ngrok.yml` or running:
   ```bash
   ngrok config check
   ```
2. **If no authtoken is configured**, stop and ask the user (Kevin) for their authtoken:
   - Direct the user to sign up or log in at: https://dashboard.ngrok.com/get-started/your-authtoken
   - Once the user provides the token, run:
     ```bash
     ngrok config add-authtoken <USER_PROVIDED_TOKEN>
     ```

## Phase 3: Exposing the Local Application

1. Ask the user (or inspect the current workspace) to determine which local port the application is running on (e.g., `3000` for React/Next.js, `5173` for Vite, `8000` for Python/FastAPI).
2. Start the ngrok tunnel in the background so it doesn't block your terminal:
   ```bash
   ngrok http <PORT> > /dev/null &
   ```
   *(Alternatively, if running in an interactive terminal or subagent, launch it synchronously).*

## Phase 4: Retrieve and Report the Public URL

Once `ngrok` is running, it exposes a local API on port `4040`. Query this API to automatically extract the live HTTPS public URL:

```bash
curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' | head -n 1
```
*(Or use `python3 -c "import urllib.request, json; print(json.loads(urllib.request.urlopen('http://localhost:4040/api/tunnels').read())['tunnels'][0]['public_url'])"`)*

Present this public HTTPS link clearly to Kevin so he can share it immediately for live demonstrations.

## Pro-Tips for the Agent & Kevin

- **Traffic Inspection:** You can open `http://localhost:4040` in your Mac's browser to see a live web dashboard showing every HTTP request and response passing through your tunnel.
- **Security Note:** Anyone with the `.ngrok-free.app` URL can access the app while ngrok is running. When the demo is done, stop the server anytime using `killall ngrok`.
