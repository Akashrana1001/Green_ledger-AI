"""
Ollama local LLM client — used when LOCAL_MODE=true instead of AWS Bedrock.
Uses a process-wide lock so only ONE document is sent to Ollama at a time.
llama3:8b is single-threaded; concurrent calls cause all of them to time out.
"""
import json
import os
import threading

import httpx

from prompts.extraction_prompts import EXTRACTION_PROMPTS

# Serialize all Ollama calls — one at a time, no concurrent requests
_ollama_lock = threading.Semaphore(1)


def _parse_json_response(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object in Ollama response: {text!r}")
    return json.loads(text[start:end])


def _ollama_base_url() -> str:
    return os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


def _ollama_model() -> str:
    return os.environ.get("OLLAMA_MODEL", "llama3:8b")


def extract_with_ollama_text(document_text: str, brsr_category: str) -> dict:
    """
    Extract the MSME spend. Return ONLY the raw JSON object. Do not include thinking tags, reasoning, or markdown. Start with { and end with }
    """
    prompt = EXTRACTION_PROMPTS.get(brsr_category)
    if not prompt:
        raise ValueError(f"No extraction prompt for category: {brsr_category}")

    truncated = document_text[:3000]
    full_prompt = f"Document content:\n{truncated}\n\n{prompt}"

    print(f"[Ollama] Waiting for lock (queue position)...", flush=True)
    with _ollama_lock:
        print(f"[Ollama] Lock acquired — sending to {_ollama_model()}", flush=True)
        response = httpx.post(
            f"{_ollama_base_url()}/api/generate",
            json={
                "model": _ollama_model(),
                "prompt": full_prompt,
                "stream": False,
                "format": "json",
            },
            timeout=300,  # 5 min — model may be busy finishing a prior request
        )
        response.raise_for_status()
        raw_text = response.json().get("response", "")
        print(f"[Ollama] Lock released", flush=True)
        return _parse_json_response(raw_text)


def generate_text(prompt: str) -> str:
    """
    Send a raw text prompt to Ollama and return the string response.
    Reuses the global lock so insight generation is serialised with extraction.
    """
    print("[Ollama] Waiting for lock (generate_text)...", flush=True)
    with _ollama_lock:
        print(f"[Ollama] Lock acquired — text generation via {_ollama_model()}", flush=True)
        response = httpx.post(
            f"{_ollama_base_url()}/api/generate",
            json={
                "model": _ollama_model(),
                "prompt": prompt,
                "stream": False,
            },
            timeout=300,
        )
        response.raise_for_status()
        raw = response.json().get("response", "")
        print("[Ollama] Lock released (generate_text)", flush=True)
        return raw


def extract_with_ollama_image(base64_image: str, brsr_category: str) -> dict:
    """Send a base64 image to a vision-capable Ollama model (llava, llama3.2-vision)."""
    prompt = EXTRACTION_PROMPTS.get(brsr_category)
    if not prompt:
        raise ValueError(f"No extraction prompt for category: {brsr_category}")

    print(f"[Ollama] Waiting for lock (image)...", flush=True)
    with _ollama_lock:
        print(f"[Ollama] Lock acquired — sending image to {_ollama_model()}", flush=True)
        response = httpx.post(
            f"{_ollama_base_url()}/api/generate",
            json={
                "model": _ollama_model(),
                "prompt": prompt,
                "images": [base64_image],
                "stream": False,
            },
            timeout=300,
        )
        response.raise_for_status()
        raw_text = response.json().get("response", "")
        print(f"[Ollama] Lock released", flush=True)
        return _parse_json_response(raw_text)
