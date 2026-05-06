"""
Process router: orchestrates the full document processing pipeline.
LOCAL_MODE:  local fetch → text/image → Ollama → Python calculate → Node sync
AWS mode:    S3 fetch → image convert → Bedrock → Python calculate → Node sync
"""
import os
import time
from datetime import datetime

import httpx
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from services.s3_fetcher import fetch_from_s3
from services.doc_converter import convert_to_base64, extract_text_content, is_text_file
from services.bedrock_client import extract_from_document, extract_from_text
from services.kpi_calculator import calculate_kpis
from services.insight_generator import generate_insights
from services.aws_sns_client import check_and_send_threshold_alerts, send_verification_alert

router = APIRouter()


class ProcessRequest(BaseModel):
    document_id: str
    s3_key: str
    # Full storage URL from the Document record. The fetcher inspects this URL
    # to decide whether to pull from S3 (boto3) or a local backend (httpx),
    # independent of LOCAL_MODE (which only controls AI model selection).
    s3_url: str | None = None
    brsr_category: str
    company_id: str
    # Optional per-request override sent by Node backend after reading
    # Settings.inferenceMode. When None, fall back to LOCAL_MODE env var.
    local_mode: bool | None = None


def _sync_to_node(
    document_id: str,
    status: str,
    extracted_raw: dict | None,
    calculated_kpis: dict | None,
    log_message: str,
    ai_insights: list | None = None,
    processing_time_s: float | None = None,
) -> None:
    """Synchronous POST back to the Node.js backend — safe to call from thread pool."""
    node_url = os.environ.get("NODE_BACKEND_URL", "http://localhost:5000")
    payload = {
        "documentId":         document_id,
        "status":             status,
        "extractedRawValues": extracted_raw,
        "calculatedKpis":     calculated_kpis,
        "logMessage":         log_message,
        "aiInsights":         ai_insights or [],
    }
    if processing_time_s is not None:
        payload["processingTimeS"] = round(processing_time_s, 2)
    try:
        with httpx.Client(timeout=30) as client:
            client.post(f"{node_url}/api/sync/kpi-result", json=payload)
    except Exception as e:
        print(f"[WARN] Could not sync to Node.js: {e}")


def _process_document(req: ProcessRequest) -> None:
    """Blocking pipeline — runs in FastAPI's thread pool via BackgroundTasks."""

    def log(msg: str) -> None:
        print(f"[{datetime.utcnow().isoformat()}] [{req.document_id}] {msg}", flush=True)

    _pipeline_start = time.perf_counter()
    try:
        log("Fetching document...")
        file_bytes = fetch_from_s3(req.s3_key, req.s3_url)

        filename = req.s3_key.split("/")[-1]
        raw_values: dict = {}

        # Inference routing priority:
        #   1. UI toggle (req.local_mode is not None) → ALWAYS wins
        #   2. .env LOCAL_MODE → fallback when the UI sends no explicit preference
        #
        # The old logic used `env_local or req_local`, which meant LOCAL_MODE=true
        # in .env would override an explicit UI request for Bedrock. Now the UI is
        # the source of truth; .env is only the default.
        env_local = os.environ.get("LOCAL_MODE", "false").strip().lower() == "true"
        use_local = req.local_mode if req.local_mode is not None else env_local

        print(
            f"[Router] Decision: UI selection was {req.local_mode!r}, "
            f"ENV default was {env_local} -> "
            f"Routing to {'Ollama' if use_local else 'Bedrock'}",
            flush=True,
        )

        # ── Ollama pre-flight — fail fast with a clear error before touching S3 ──
        if use_local:
            ollama_base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            try:
                with httpx.Client(timeout=4) as probe:
                    r = probe.get(f"{ollama_base}/api/tags")
                    if r.status_code != 200:
                        raise ConnectionError(f"Ollama returned HTTP {r.status_code}")
            except Exception as ollama_err:
                raise ConnectionError(
                    f"Ollama is not reachable at {ollama_base}. "
                    f"Start Ollama locally or switch the inference toggle to AWS Bedrock. "
                    f"Detail: {ollama_err}"
                ) from ollama_err

        if use_local:
            from services.text_extractor import extract_pdf_text
            from services.ollama_client import extract_with_ollama_text, extract_with_ollama_image

            text = ""

            # 1. Plain-text formats (.txt/.md/.csv/.log/.tsv) → decode directly
            if is_text_file(filename):
                log(f"Reading plain-text file ({filename})...")
                text = extract_text_content(file_bytes, filename)

            # 2. Structured PDF text extraction (static layer + AcroForm fields)
            if not text and filename.lower().endswith(".pdf"):
                log("Extracting text from PDF (PyMuPDF — includes AcroForm fields)...")
                text = extract_pdf_text(file_bytes)

            # 3. Last-ditch UTF-8 read (for non-standard PDFs / unknown text formats)
            if not text:
                try:
                    raw_decoded = file_bytes.decode("utf-8", errors="ignore").strip()
                    if len(raw_decoded) > 20:
                        text = raw_decoded
                        log(f"Read {len(text)} chars as plain text")
                except Exception:
                    pass

            if text:
                model = os.environ.get("OLLAMA_MODEL", "llama3:8b")
                log(f"Sending text to Ollama model '{model}'...")
                raw_values = extract_with_ollama_text(text, req.brsr_category)
            else:
                # 4. Final fallback: image conversion (needs poppler for PDF, works for images)
                log("No text found — converting to image for vision model...")
                base64_images = convert_to_base64(file_bytes, filename)
                if not base64_images:
                    raise ValueError(
                        "Could not extract text or convert to image. "
                        "Upload a text-based PDF, a plain text file, or an image."
                    )
                raw_values = extract_with_ollama_image(base64_images[0], req.brsr_category)

        else:
            # AWS Bedrock path
            if is_text_file(filename):
                log(f"Reading plain-text file ({filename}) for Bedrock text extraction...")
                doc_text = extract_text_content(file_bytes, filename)
                if not doc_text:
                    raise ValueError(f"Empty or unreadable text file: {filename}")
                log(f"Sending {len(doc_text)} chars to AWS Bedrock text path ({req.brsr_category})...")
                raw_values = extract_from_text(doc_text, req.brsr_category)
            else:
                log("Converting document to base64...")
                base64_images = convert_to_base64(file_bytes, filename)
                if not base64_images:
                    raise ValueError(f"Unsupported file format: {filename}")
                log(f"Sending {len(base64_images)} page(s) to AWS Bedrock ({req.brsr_category})...")
                raw_values = extract_from_document(base64_images, req.brsr_category)

        log(f"Extracted raw values: {raw_values}")
        log("Running SEBI KPI calculations...")
        kpis = calculate_kpis(req.brsr_category, raw_values)
        log(f"Calculated KPIs: {kpis}")

        # ── SNS threshold alerts (non-blocking — failures are logged only) ──
        log("Checking ESG alert thresholds (SNS)...")
        try:
            check_and_send_threshold_alerts(kpis, filename, req.brsr_category)
        except Exception as sns_err:
            log(f"SNS skipped (non-fatal): {sns_err}")

        # ── Insights — wrapped in try/except even though generate_insights
        # already swallows all failures. Defence in depth: under no circumstances
        # may an insights failure prevent the verified sync to Node.js.
        log(f"Generating AI actionable insights (InsightGenerator, use_local={use_local})...")
        try:
            insights = generate_insights(req.brsr_category, kpis, use_local=use_local)
        except Exception as ins_err:
            log(f"Insights skipped (non-fatal): {ins_err}")
            insights = []
        log(f"Generated {len(insights)} insight(s)")

        elapsed = time.perf_counter() - _pipeline_start
        log(f"Pipeline complete in {elapsed:.2f}s — syncing verified status to Node.js with "
            f"{len(raw_values or {})} raw values + {len(kpis or {})} KPIs (insights: {len(insights)})")
        _sync_to_node(
            req.document_id, "verified", raw_values, kpis,
            f"Extraction complete in {elapsed:.1f}s. KPIs: {list(kpis.keys())}",
            ai_insights=insights,
            processing_time_s=elapsed,
        )
        log("Synced to Node.js — status: verified")

        # ── SNS verification alert (document is now live on dashboard) ───────
        kpi_count = sum(
            len(v) if isinstance(v, dict) else 1
            for v in kpis.values()
            if v is not None
        )
        send_verification_alert(filename, req.brsr_category, kpi_count)

    except Exception as err:
        elapsed = time.perf_counter() - _pipeline_start
        log(f"FAILED after {elapsed:.2f}s: {err}")
        _sync_to_node(
            req.document_id, "failed", None, None,
            f"Error after {elapsed:.1f}s: {str(err)}",
            processing_time_s=elapsed,
        )


@router.post("/process")
async def process_document(req: ProcessRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_process_document, req)
    return {"message": "Processing started", "document_id": req.document_id}
