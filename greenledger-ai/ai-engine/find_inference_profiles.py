"""
Discover invokable Anthropic models and their inference profile IDs.

Cognizant's Bedrock-Limited role can't call ListInferenceProfiles, but it CAN
call ListFoundationModels which returns each model's supported inference types
and the cross-region inference-profile ID is derivable from the model ID.
"""
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import boto3
from botocore.exceptions import ClientError

REGION = os.environ["AWS_BEDROCK_REGION"]

control = boto3.client(
    "bedrock",
    region_name=REGION,
    aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
    aws_session_token=os.environ["AWS_BEDROCK_SESSION_TOKEN"],
)
runtime = boto3.client(
    "bedrock-runtime",
    region_name=REGION,
    aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
    aws_session_token=os.environ["AWS_BEDROCK_SESSION_TOKEN"],
)

# Region-prefix map for cross-region inference profiles
APAC_PREFIX = "apac."

resp = control.list_foundation_models(byProvider="anthropic")
models = resp.get("modelSummaries", [])

print(f"Region: {REGION}\n")
print(f"Found {len(models)} Anthropic model(s) listed.\n")
print(f"{'Model ID':<55} | {'Inference types':<25} | Status")
print("-" * 110)

candidates = []
for m in models:
    mid = m.get("modelId", "?")
    inf_types = m.get("inferenceTypesSupported", [])
    print(f"{mid:<55} | {','.join(inf_types):<25}")
    if "INFERENCE_PROFILE" in inf_types:
        # Cross-region inference profile ID is the model ID with apac. prefix
        candidates.append(APAC_PREFIX + mid)
    if "ON_DEMAND" in inf_types:
        candidates.append(mid)

print(f"\n{'='*80}\n")
print(f"Probing {len(candidates)} candidate(s) for actual invocation:\n")

body = json.dumps({
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 5,
    "messages": [{"role": "user", "content": "hi"}],
})

working = []
for cid in candidates:
    try:
        runtime.invoke_model(modelId=cid, body=body)
        print(f"  [WORKS]  {cid}")
        working.append(cid)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "?")
        msg  = e.response.get("Error", {}).get("Message", "")[:55]
        print(f"  [{code:<25}] {cid}  ({msg})")

print(f"\n{'='*80}\n")
if working:
    haiku  = next((m for m in working if "haiku" in m.lower()), None)
    sonnet = next((m for m in working if "sonnet" in m.lower()), None)
    opus   = next((m for m in working if "opus" in m.lower()), None)
    print("RECOMMENDED .env values:\n")
    if haiku:
        print(f"  BEDROCK_MODEL_HAIKU={haiku}")
    if sonnet:
        print(f"  BEDROCK_MODEL_SONNET={sonnet}")
    elif haiku:
        print(f"  BEDROCK_MODEL_SONNET={haiku}    # no sonnet access — fall back to haiku")
    if opus and not (haiku or sonnet):
        print(f"  BEDROCK_MODEL_HAIKU={opus}     # only opus available")
else:
    print("NO models invokable. Cognizant admin needs to grant model access.")
