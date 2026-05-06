"""AWS Bedrock client — called only when LOCAL_MODE is not set. Do not call directly from local mode."""
import json
import os

from prompts.extraction_prompts import EXTRACTION_PROMPTS

# Cap raw text payloads sent to Bedrock so a huge .txt/.csv doesn't blow the
# input-token budget. ~80k chars ≈ ~25k tokens, well under Claude's window.
MAX_TEXT_CHARS = 80_000


def _bedrock_client():
    import boto3
    # AWS_BEDROCK_SESSION_TOKEN is optional — only set for temporary STS creds
    # (ASIA…). Permanent IAM keys (AKIA…) leave it blank or unset.
    session_token = os.environ.get("AWS_BEDROCK_SESSION_TOKEN") or None
    return boto3.client(
        "bedrock-runtime",
        region_name=os.environ["AWS_BEDROCK_REGION"],
        aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
        aws_session_token=session_token,
    )


def _invoke_bedrock(model_id: str, base64_image: str, prompt: str) -> str:
    client = _bedrock_client()
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64_image}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }
    response = client.invoke_model(
        modelId=model_id, body=json.dumps(body),
        contentType="application/json", accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


def _invoke_bedrock_text(model_id: str, document_text: str, prompt: str) -> str:
    """Text-only Bedrock invocation — used for .txt/.md/.csv inputs."""
    client = _bedrock_client()
    truncated = document_text[:MAX_TEXT_CHARS]
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Document content:\n\n{truncated}\n\n---\n\n{prompt}"},
                ],
            }
        ],
    }
    response = client.invoke_model(
        modelId=model_id, body=json.dumps(body),
        contentType="application/json", accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


def _parse_json_response(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response: {text!r}")
    return json.loads(text[start:end])


def _resolve_prompt(brsr_category: str) -> str:
    prompt = EXTRACTION_PROMPTS.get(brsr_category)
    if not prompt:
        raise ValueError(f"No extraction prompt defined for category: {brsr_category}")
    return prompt


def extract_from_document(base64_images: list[str], brsr_category: str) -> dict:
    """
    AWS Bedrock image extraction — Haiku first, Sonnet fallback.
    Only called when LOCAL_MODE is not set; process.py routes local mode to ollama_client.
    """
    target_image = base64_images[0] if base64_images else None
    if not target_image:
        raise ValueError("No image data provided for extraction")

    from botocore.exceptions import ClientError as BotoClientError

    prompt       = _resolve_prompt(brsr_category)
    haiku_model  = os.environ["BEDROCK_MODEL_HAIKU"]
    sonnet_model = os.environ["BEDROCK_MODEL_SONNET"]

    try:
        raw_text = _invoke_bedrock(haiku_model, target_image, prompt)
        return _parse_json_response(raw_text)
    except (ValueError, json.JSONDecodeError, BotoClientError) as haiku_err:
        print(f"Haiku failed ({haiku_err}), falling back to Sonnet...")

    try:
        raw_text = _invoke_bedrock(sonnet_model, target_image, prompt)
        return _parse_json_response(raw_text)
    except Exception as sonnet_err:
        raise RuntimeError(f"Both Haiku and Sonnet failed: {sonnet_err}") from sonnet_err


def extract_from_text(document_text: str, brsr_category: str) -> dict:
    """
    AWS Bedrock text-only extraction — Haiku first, Sonnet fallback.
    Used for .txt/.md/.csv reports that don't need vision.
    """
    if not document_text or not document_text.strip():
        raise ValueError("No text content provided for extraction")

    from botocore.exceptions import ClientError as BotoClientError

    prompt       = _resolve_prompt(brsr_category)
    haiku_model  = os.environ["BEDROCK_MODEL_HAIKU"]
    sonnet_model = os.environ["BEDROCK_MODEL_SONNET"]

    try:
        raw_text = _invoke_bedrock_text(haiku_model, document_text, prompt)
        return _parse_json_response(raw_text)
    except (ValueError, json.JSONDecodeError, BotoClientError) as haiku_err:
        print(f"Haiku (text) failed ({haiku_err}), falling back to Sonnet...")

    try:
        raw_text = _invoke_bedrock_text(sonnet_model, document_text, prompt)
        return _parse_json_response(raw_text)
    except Exception as sonnet_err:
        raise RuntimeError(f"Both Haiku and Sonnet (text) failed: {sonnet_err}") from sonnet_err
