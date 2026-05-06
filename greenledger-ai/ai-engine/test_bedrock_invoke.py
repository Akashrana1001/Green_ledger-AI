"""
Probe which Anthropic model IDs are actually INVOKABLE in this Bedrock account.

list_foundation_models returns every model in the region — but invoke_model
needs a separate model-access grant from the account admin. This script
tries to invoke each candidate with a 5-token prompt and reports which work.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import boto3
from botocore.exceptions import ClientError

CANDIDATES = [
    # Claude 3 family (older — may not be approved in this account)
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    # Claude 4 family (saw these in list_foundation_models earlier)
    "anthropic.claude-haiku-4-5-20251001-v1:0",
    "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "anthropic.claude-opus-4-7",
    # Inference-profile variants (some accounts ONLY allow these, not raw model IDs)
    "apac.anthropic.claude-haiku-4-5-20251001-v1:0",
    "apac.anthropic.claude-sonnet-4-5-20250929-v1:0",
]

client = boto3.client(
    "bedrock-runtime",
    region_name=os.environ["AWS_BEDROCK_REGION"],
    aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
    aws_session_token=os.environ["AWS_BEDROCK_SESSION_TOKEN"],
)

body = json.dumps({
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 5,
    "messages": [{"role": "user", "content": "Say hi"}],
})

print(f"Region: {os.environ['AWS_BEDROCK_REGION']}\n")
print(f"{'Model ID':<60} | Result")
print("-" * 100)

working = []
for model_id in CANDIDATES:
    try:
        client.invoke_model(modelId=model_id, body=body)
        print(f"{model_id:<60} | [INVOKABLE]")
        working.append(model_id)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "?")
        msg  = e.response.get("Error", {}).get("Message", "")[:60]
        print(f"{model_id:<60} | [FAIL {code}] {msg}")
    except Exception as e:
        print(f"{model_id:<60} | [FAIL {type(e).__name__}] {str(e)[:60]}")

print("\n" + "=" * 100)
if working:
    haiku_pick  = next((m for m in working if "haiku" in m.lower()), working[0])
    sonnet_pick = next((m for m in working if "sonnet" in m.lower()), haiku_pick)
    print(f"\nRECOMMENDED .env values:\n")
    print(f"  BEDROCK_MODEL_HAIKU={haiku_pick}")
    print(f"  BEDROCK_MODEL_SONNET={sonnet_pick}")
else:
    print("\nNO models were invokable. Ask Cognizant admin to grant model access.")
