"""
Diagnostic: enumerate Bedrock model + inference profile access for the
AWS_BEDROCK_* credentials in .env. Run this once to see exactly what
your Cognizant STS session is allowed to call.

  venv\\Scripts\\python list_bedrock_access.py
"""
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

REGION = os.environ["AWS_BEDROCK_REGION"]

bedrock = boto3.client(
    "bedrock",
    region_name=REGION,
    aws_access_key_id=os.environ["AWS_BEDROCK_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_BEDROCK_SECRET_ACCESS_KEY"],
    aws_session_token=os.environ["AWS_BEDROCK_SESSION_TOKEN"],
)

print(f"\n=== Region: {REGION} ===\n")

print("--- Inference Profiles (these are what you need) ---")
try:
    profiles = bedrock.list_inference_profiles().get("inferenceProfileSummaries", [])
    for p in profiles:
        if "anthropic" in p["inferenceProfileId"].lower():
            print(f"  {p['inferenceProfileId']:60s}  status={p.get('status')}")
    if not profiles:
        print("  (none returned — IAM may be blocking ListInferenceProfiles)")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n--- Foundation Models (on-demand) ---")
try:
    models = bedrock.list_foundation_models(byProvider="anthropic").get("modelSummaries", [])
    for m in models:
        modes = ",".join(m.get("inferenceTypesSupported", []))
        print(f"  {m['modelId']:60s}  modes=[{modes}]")
except Exception as e:
    print(f"  ERROR: {e}")
