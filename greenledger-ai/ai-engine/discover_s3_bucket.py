"""
List every S3 bucket reachable with the personal IAM keys.
Reads AWS_S3_* from ai-engine/.env. Prints names so we can pick the right one.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(ENV_PATH, override=True)

import boto3
from botocore.exceptions import ClientError

try:
    client = boto3.client(
        "s3",
        region_name=os.environ["AWS_S3_REGION"],
        aws_access_key_id=os.environ["AWS_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_S3_SECRET_ACCESS_KEY"],
    )
    response = client.list_buckets()
    buckets = response.get("Buckets", [])
    if not buckets:
        print("[INFO] No buckets exist in this AWS account.")
        print("[INFO] Create one with:  aws s3 mb s3://green-ledger-ai --region us-east-1")
        sys.exit(2)

    print(f"[OK] Found {len(buckets)} bucket(s) in this AWS account:")
    for b in buckets:
        print(f"     - {b['Name']}   (created {b['CreationDate']})")

    # Heuristic: pick the most likely bucket
    candidates = [b["Name"] for b in buckets if "ledger" in b["Name"].lower() or "green" in b["Name"].lower()]
    if candidates:
        print(f"\n[SUGGEST] Most likely your bucket: {candidates[0]}")
    else:
        print(f"\n[SUGGEST] No 'green'/'ledger' match. Pick one manually from the list above.")

except ClientError as e:
    code = e.response.get("Error", {}).get("Code", "Unknown")
    msg  = e.response.get("Error", {}).get("Message", str(e))
    print(f"[FAIL] {code}: {msg}")
    sys.exit(1)
