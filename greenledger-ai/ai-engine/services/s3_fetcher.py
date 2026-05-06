"""
Storage-agnostic document fetcher.

Routing logic (determined from the full s3_url, NOT from LOCAL_MODE):

  URL contains "amazonaws.com"    → pull from AWS S3 via boto3
                                    uses AWS_S3_* credentials (permanent IAM)
  URL contains "localhost" or
               "127.0.0.1"        → pull from the local Node.js backend via httpx

  s3_url is None / unrecognised   → fall back to direct S3 fetch using the s3_key
                                    (safe default for legacy callers)

LOCAL_MODE is intentionally NOT checked here. LOCAL_MODE controls AI model
selection (Ollama vs Bedrock) and must remain independent of where the file
is stored. A user can run Ollama locally while their files live in S3.
"""
import os

import httpx


def fetch_from_s3(s3_key: str, s3_url: str | None = None) -> bytes:
    """
    Return the raw bytes of the document identified by s3_key.

    Parameters
    ----------
    s3_key : str
        The object key in S3  (e.g. 'documents/companyId/uuid.pdf').
        Also used as the filename stem for local-backend requests.
    s3_url : str | None
        The full storage URL from the Document MongoDB record.
        Used to decide which storage backend to hit.
    """
    url = s3_url or ""

    # ── Branch 1: AWS S3 ──────────────────────────────────────────────────────
    if "amazonaws.com" in url:
        return _fetch_from_s3_boto3(s3_key)

    # ── Branch 2: local Node.js backend ──────────────────────────────────────
    if "localhost" in url or "127.0.0.1" in url:
        return _fetch_from_local(s3_key, url)

    # ── Branch 3: no URL or unrecognised scheme — default to S3 ──────────────
    # This path is hit when an older job payload didn't include s3_url.
    print(
        f"[s3_fetcher] s3_url not provided or unrecognised ('{url[:60] or 'empty'}') "
        f"— falling back to direct S3 fetch for key '{s3_key}'"
    )
    return _fetch_from_s3_boto3(s3_key)


# ── Private helpers ────────────────────────────────────────────────────────────

def _fetch_from_s3_boto3(s3_key: str) -> bytes:
    """Download a file directly from the S3 bucket using permanent IAM credentials."""
    import boto3
    from botocore.exceptions import ClientError

    # Personal AWS account — permanent IAM keys (AKIA…), no session token.
    # Vars are AWS_S3_* to keep them isolated from the Cognizant Bedrock creds.
    session_token = os.environ.get("AWS_S3_SESSION_TOKEN") or None
    client = boto3.client(
        "s3",
        region_name=os.environ["AWS_S3_REGION"],
        aws_access_key_id=os.environ["AWS_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_S3_SECRET_ACCESS_KEY"],
        aws_session_token=session_token,
    )
    try:
        response = client.get_object(
            Bucket=os.environ["S3_BUCKET_NAME"],
            Key=s3_key,
        )
        return response["Body"].read()
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_msg  = e.response["Error"]["Message"]
        raise RuntimeError(
            f"S3 fetch failed for key '{s3_key}': "
            f"[{error_code}] {error_msg}"
        ) from e


def _fetch_from_local(s3_key: str, url: str) -> bytes:
    """Fetch a file from the local Node.js backend over HTTP."""
    # The local backend serves files at /uploads/<s3_key_with_slashes_replaced_by_underscores>
    node_url = os.environ.get("NODE_BACKEND_URL", "http://localhost:5000")
    filename = s3_key.replace("/", "_")
    fetch_url = f"{node_url}/uploads/{filename}"
    try:
        response = httpx.get(fetch_url, timeout=30)
        response.raise_for_status()
        return response.content
    except Exception as e:
        raise RuntimeError(
            f"Local file fetch failed for key '{s3_key}' "
            f"(tried: {fetch_url}): {e}"
        ) from e
