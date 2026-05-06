from dotenv import load_dotenv
load_dotenv()

import os
import json

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

from routers.process import router as process_router

app = FastAPI(title="GreenLedger AI Engine", version="1.0.0")

app.include_router(process_router)


# ── Chat endpoint ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    kpi_context: str = ""
    local_mode: bool = True


CHAT_SYSTEM = (
    "You are GreenLedger AI, an expert SEBI BRSR sustainability advisor embedded in an "
    "enterprise ESG reporting platform. You have access to the company's verified KPI data below.\n\n"
    "Rules:\n"
    "1. Answer ONLY based on the provided KPI data. Do not fabricate numbers.\n"
    "2. When suggesting improvements, cite the exact current metric value.\n"
    "3. Be specific and actionable — give concrete steps, not vague advice.\n"
    "4. Keep answers concise (3–5 sentences max unless a detailed breakdown is asked for).\n"
    "5. If the required data is not in the KPI context, say so clearly.\n\n"
    "Company Verified KPI Data:\n{kpi_context}"
)


@app.post("/chat")
def chat(req: ChatRequest):
    """
    ESG chat endpoint. Routes to Ollama (local_mode=True) or AWS Bedrock (local_mode=False).
    Called by the Node.js backend — never directly from the browser.
    """
    system_prompt = CHAT_SYSTEM.format(kpi_context=req.kpi_context or "No KPI data provided.")

    if req.local_mode:
        return _chat_ollama(system_prompt, req.question)
    else:
        return _chat_bedrock(system_prompt, req.question)


def _chat_ollama(system_prompt: str, question: str) -> dict:
    """Call Ollama chat API and return { answer }."""
    import os
    from services.ollama_client import _ollama_lock

    base_url    = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    model       = os.environ.get("OLLAMA_MODEL", "llama3:8b")
    payload     = {
        "model": model,
        "messages": [
            {"role": "system",  "content": system_prompt},
            {"role": "user",    "content": question},
        ],
        "stream": False,
    }

    with _ollama_lock:
        try:
            r = httpx.post(f"{base_url}/api/chat", json=payload, timeout=120)
            r.raise_for_status()
            data = r.json()
            answer = data.get("message", {}).get("content", "No response from model.")
            return {"answer": answer}
        except Exception as e:
            return {"answer": f"Local model error: {e}"}


def _chat_bedrock(system_prompt: str, question: str) -> dict:
    """Call AWS Bedrock (Claude Haiku) and return { answer }."""
    import boto3
    import os

    model_id = os.environ.get("BEDROCK_MODEL_HAIKU", "anthropic.claude-3-haiku-20240307-v1:0")
    region   = os.environ.get("AWS_REGION", "us-east-1")

    client = boto3.client("bedrock-runtime", region_name=region)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "system": system_prompt,
        "messages": [{"role": "user", "content": question}],
    }

    try:
        resp   = client.invoke_model(modelId=model_id, body=json.dumps(body))
        parsed = json.loads(resp["body"].read())
        answer = parsed.get("content", [{}])[0].get("text", "No response from Bedrock.")
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Bedrock error: {e}"}


@app.get("/health")
def health():
    """
    Health endpoint for the engine.

    The Ollama connectivity probe runs UNCONDITIONALLY — it is not gated by
    the `LOCAL_MODE` env var. The frontend toggle's React state is the only
    thing that decides which mode to use; this endpoint just reports facts
    about the engine's environment so the UI can act on them.

    `local_mode` is reported separately as a *default*, used only when the
    UI sends no explicit preference. The ping always runs so the toggle can
    be flipped to Local at runtime even when the .env default is AWS.
    """
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model = os.environ.get("OLLAMA_MODEL", "llava")
    env_local_default = os.environ.get("LOCAL_MODE", "false").strip().lower() == "true"

    ollama_ok = False
    try:
        r = httpx.get(f"{base_url}/api/tags", timeout=3)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    return {
        "status":           "ok",
        "service":          "GreenLedger AI Engine",
        "local_mode":       env_local_default,   # informational: env default only
        "ollama_connected": ollama_ok,           # always reported, never null
        "ollama_model":     ollama_model,
        "ollama_base_url":  base_url,
    }
