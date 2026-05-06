"""
GreenLedger AI — AWS Pre-Flight Verification
============================================

Standalone diagnostic. Run BEFORE booting the FastAPI engine to confirm
both AWS account credentials are loaded and reachable.

  Personal account  → S3       (us-east-1, permanent IAM, no session token)
  Cognizant account → Bedrock  (ap-south-1, temporary STS, session token required)

Usage:
    cd greenledger-ai/ai-engine
    venv\\Scripts\\python test_aws_connections.py        # Windows
    ./venv/bin/python test_aws_connections.py            # Linux/Mac
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ── Load the AI engine's .env file (next to this script) ────────────────────
ENV_PATH = Path(__file__).parent / ".env"
if not ENV_PATH.exists():
    print(f"\033[91m[FATAL] .env not found at {ENV_PATH}\033[0m")
    sys.exit(1)
load_dotenv(ENV_PATH, override=True)

# ── ANSI colour helpers (Windows terminals support these in modern PowerShell) ─
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def fail(msg: str) -> None:
    print(f"{RED}{BOLD}[FAIL]{RESET} {msg}")


def ok(msg: str) -> None:
    print(f"{GREEN}{BOLD}[ OK ]{RESET} {msg}")


def info(msg: str) -> None:
    print(f"{CYAN}[INFO]{RESET} {msg}")


def require_env(*keys: str) -> bool:
    """Verify every key in keys is present in the loaded .env. Returns True if all set."""
    missing = [k for k in keys if not os.environ.get(k)]
    if missing:
        fail(f"Missing environment variables: {', '.join(missing)}")
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1: Personal AWS S3
# ─────────────────────────────────────────────────────────────────────────────
def test_s3() -> bool:
    print(f"\n{BOLD}── TEST 1/2 · Personal AWS · S3 ────────────────────────────{RESET}")

    if not require_env("AWS_S3_REGION", "AWS_S3_ACCESS_KEY_ID",
                       "AWS_S3_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"):
        return False

    region = os.environ["AWS_S3_REGION"]
    bucket = os.environ["S3_BUCKET_NAME"]
    key    = os.environ["AWS_S3_ACCESS_KEY_ID"]

    info(f"region = {region}")
    info(f"bucket = {bucket}")
    info(f"access key = {key[:4]}…{key[-4:]} ({'permanent IAM' if key.startswith('AKIA') else 'TEMPORARY (wrong type for personal)'})")

    if not key.startswith("AKIA"):
        fail("Personal S3 key should start with AKIA (permanent). "
             "An ASIA key here suggests you swapped Bedrock and S3 credentials.")
        return False

    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
    except ImportError as e:
        fail(f"boto3 not installed: {e}. Run `pip install boto3 python-dotenv`")
        return False

    try:
        client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=os.environ["AWS_S3_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_S3_SECRET_ACCESS_KEY"],
        )
        response = client.list_objects_v2(Bucket=bucket, MaxKeys=1)
        count = response.get("KeyCount", 0)
        ok(f"S3 connection succeeded — bucket contains {count} object{'s' if count != 1 else ''} (sampled MaxKeys=1)")
        return True

    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "Unknown")
        msg  = e.response.get("Error", {}).get("Message", str(e))
        if code == "PermanentRedirect":
            fail(f"PermanentRedirect — bucket '{bucket}' is in a different region than '{region}'. "
                 f"Update AWS_S3_REGION to match the bucket's actual region.")
        elif code == "AccessDenied":
            fail(f"AccessDenied — IAM user lacks s3:ListBucket on '{bucket}'. "
                 f"Add the policy or check the bucket name. Detail: {msg}")
        elif code == "NoSuchBucket":
            fail(f"NoSuchBucket — '{bucket}' does not exist (or name has illegal uppercase chars). "
                 f"S3 bucket names must be lowercase.")
        elif code == "InvalidAccessKeyId":
            fail(f"InvalidAccessKeyId — AWS_S3_ACCESS_KEY_ID is wrong or deleted.")
        elif code == "SignatureDoesNotMatch":
            fail("SignatureDoesNotMatch — AWS_S3_SECRET_ACCESS_KEY is wrong "
                 "(possibly truncated or has a stray char).")
        else:
            fail(f"S3 ClientError [{code}]: {msg}")
        return False

    except NoCredentialsError:
        fail("NoCredentialsError — boto3 could not read the keys.")
        return False
    except EndpointConnectionError as e:
        fail(f"EndpointConnectionError — cannot reach S3: {e}")
        return False
    except Exception as e:
        fail(f"Unexpected error: {type(e).__name__}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2: Cognizant AWS Bedrock
# ─────────────────────────────────────────────────────────────────────────────
def test_bedrock() -> bool:
    print(f"\n{BOLD}── TEST 2/2 · Cognizant AWS · Bedrock ──────────────────────{RESET}")

    if not require_env("AWS_BEDROCK_REGION", "AWS_BEDROCK_ACCESS_KEY_ID",
                       "AWS_BEDROCK_SECRET_ACCESS_KEY", "AWS_BEDROCK_SESSION_TOKEN"):
        return False

    region = os.environ["AWS_BEDROCK_REGION"]
    key    = os.environ["AWS_BEDROCK_ACCESS_KEY_ID"]

    info(f"region = {region}")
    info(f"access key = {key[:4]}…{key[-4:]} ({'TEMPORARY (correct)' if key.startswith('ASIA') else 'permanent (unusual for Cognizant STS)'})")

    if not key.startswith("ASIA"):
        info(f"{YELLOW}Note: Cognizant Bedrock typically issues ASIA* temporary keys. "
             f"Got a non-ASIA key — proceeding but expect failures if this is meant to be STS.{RESET}")

    try:
        import boto3
        from botocore.exceptions import ClientError, EndpointConnectionError
    except ImportError as e:
        fail(f"boto3 not installed: {e}")
        return False

    try:
        # Use 'bedrock' (control plane) for list_foundation_models; 'bedrock-runtime' is for invoke
        client = boto3.client(
            "bedrock",
            region_name=region,
            aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
            aws_session_token=os.environ["AWS_BEDROCK_SESSION_TOKEN"],
        )
        response = client.list_foundation_models()
        models = response.get("modelSummaries", [])
        anthropic = [m["modelId"] for m in models if "anthropic" in m.get("modelId", "").lower()]
        ok(f"Bedrock connection succeeded — {len(models)} models available, {len(anthropic)} from Anthropic")
        if anthropic:
            info(f"Anthropic models accessible: {', '.join(anthropic[:3])}{'…' if len(anthropic) > 3 else ''}")
        return True

    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "Unknown")
        msg  = e.response.get("Error", {}).get("Message", str(e))
        if code in ("InvalidAccessKeyId", "UnrecognizedClientException"):
            fail(f"{code} — AWS_BEDROCK_ACCESS_KEY_ID is invalid. "
                 f"Cognizant STS tokens may have been rotated; request fresh credentials.")
        elif code in ("ExpiredTokenException", "ExpiredToken"):
            fail("ExpiredTokenException — the Cognizant session token has expired. "
                 "Generate a new STS token and update AWS_BEDROCK_SESSION_TOKEN.")
        elif code == "AccessDeniedException":
            fail(f"AccessDeniedException — credentials valid but lack bedrock:ListFoundationModels. "
                 f"Detail: {msg}")
        elif code == "ValidationException":
            fail(f"ValidationException — likely region '{region}' has no Bedrock models. "
                 f"Detail: {msg}")
        else:
            fail(f"Bedrock ClientError [{code}]: {msg}")
        return False

    except EndpointConnectionError as e:
        fail(f"EndpointConnectionError — Bedrock is not available in '{region}': {e}")
        return False
    except Exception as e:
        fail(f"Unexpected error: {type(e).__name__}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"{BOLD}╔════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}║  GreenLedger AI · AWS Pre-Flight Verification              ║{RESET}")
    print(f"{BOLD}╚════════════════════════════════════════════════════════════╝{RESET}")
    info(f"Loaded env from: {ENV_PATH}")

    s3_ok      = test_s3()
    bedrock_ok = test_bedrock()

    print(f"\n{BOLD}── Summary ─────────────────────────────────────────────────{RESET}")
    print(f"  Personal S3       : {GREEN + 'PASS' + RESET if s3_ok      else RED + 'FAIL' + RESET}")
    print(f"  Cognizant Bedrock : {GREEN + 'PASS' + RESET if bedrock_ok else RED + 'FAIL' + RESET}")

    if s3_ok and bedrock_ok:
        print(f"\n{GREEN}{BOLD}✓ ALL CONNECTIONS HEALTHY — safe to boot the AI engine.{RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{RED}{BOLD}✗ One or more connections failed. Fix the errors above before starting the server.{RESET}\n")
        sys.exit(1)
