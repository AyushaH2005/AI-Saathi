import json
import os
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from config import AGENT_PORT
from graph import agent, AgentState

C = {
    "BLUE": "\033[94m", "YELLOW": "\033[93m", "GREEN": "\033[92m",
    "ORANGE": "\033[33m", "WHITE": "\033[97m", "RED": "\033[91m",
    "CYAN": "\033[96m", "DIM": "\033[90m", "BOLD": "\033[1m",
    "RESET": "\033[0m",
}

app = FastAPI(title="AI Saathi Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    user_input: str
    page_text: str = ""
    page_url: str = ""
    page_title: str = ""
    conversation_history: list[dict] = []


class ConfirmRequest(BaseModel):
    action: dict


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-saathi-agent"}


@app.post("/api/agent")
async def run_agent(request: AgentRequest):
    initial_state: AgentState = {
        "user_input": request.user_input,
        "page_text": request.page_text,
        "page_url": request.page_url,
        "page_title": request.page_title,
        "language": "hi",
        "intent": "general",
        "confidence": 0.0,
        "response_text": "",
        "tts_text": "",
        "actions": [],
        "guardrails": [],
        "conversation_history": request.conversation_history,
        "extracted_query": "",
        "needs_clarification": False,
        "clarification_question": "",
    }

    result = agent.invoke(initial_state)

    # Response summary
    resp_text = result.get("response_text", "")
    actions = result.get("actions", [])
    guardrails = result.get("guardrails", [])
    print(f"{C['RED']}🔴 RESPONSE  {C['RESET']}Sent {len(resp_text)} chars, {len(guardrails)} guardrails, {len(actions)} action(s)")
    for a in actions:
        action_detail = a.get("url") or a.get("selector") or a.get("action", "")
        print(f"{C['ORANGE']}🟠 ACTION    {C['RESET']}{a.get('action', 'unknown')}: {action_detail}")
    for g in guardrails:
        print(f"{C['YELLOW']}🛡️ GUARDRAIL {C['RESET']}{g.get('action', 'unknown')}: {g.get('field_type', g.get('field', ''))}")
    if resp_text:
        preview = resp_text[:120].replace("\n", " ")
        print(f"{C['CYAN']}💬 PREVIEW   {C['RESET']}{preview}{'...' if len(resp_text) > 120 else ''}")
    print(f"{C['DIM']}{'─' * 60}{C['RESET']}")

    return {
        "response_text": result.get("response_text", ""),
        "tts_text": result.get("tts_text", ""),
        "actions": result.get("actions", []),
        "guardrails": result.get("guardrails", []),
        "intent": result.get("intent", "general"),
        "language": result.get("language", "hi"),
    }


@app.post("/api/execute-confirmed")
async def execute_confirmed(request: ConfirmRequest):
    """Execute a guardrail-protected action after user confirmation."""
    action = request.action
    action_type = action.get("action", "")

    if action_type == "confirm_fill":
        return {
            "status": "executed",
            "action": {
                "action": "fill_field",
                "selector": action.get("selector", ""),
                "value": action.get("value", ""),
            }
        }
    elif action_type == "confirm_click":
        return {
            "status": "executed",
            "action": {
                "action": "click",
                "selector": action.get("selector", ""),
            }
        }
    return {"status": "unknown_action"}


@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper API."""
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY not configured"}

    client = OpenAI(api_key=api_key)

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="hi",
            )
        text = transcript.text.strip()
        print(f"{C['CYAN']}🎤 STT       {C['RESET']}Transcribed: \"{text}\"")
        return {"text": text}
    except Exception as e:
        print(f"{C['RED']}🎤 STT ERROR {C['RESET']}{e}")
        return {"error": str(e), "text": ""}
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=AGENT_PORT)
