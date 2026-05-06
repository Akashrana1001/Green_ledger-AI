"""Try to create a fresh S3 bucket using the personal IAM keys."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import boto3
from botocore.exceptions import ClientError

BUCKET = "green-ledger-ai"
REGION = os.environ["AWS_S3_REGION"]

client = boto3.client(
    "s3",
    region_name=REGION,
    aws_access_key_id=os.environ["AWS_S3_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_S3_SECRET_ACCESS_KEY"],
)

try:
    # us-east-1 bucket creation does NOT take CreateBucketConfiguration
    if REGION == "us-east-1":
        client.create_bucket(Bucket=BUCKET)
    else:
        client.create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
    print(f"[OK] Bucket '{BUCKET}' created in {REGION}.")
except ClientError as e:
    code = e.response.get("Error", {}).get("Code", "?")
    msg  = e.response.get("Error", {}).get("Message", str(e))
    if code == "BucketAlreadyOwnedByYou":
        print(f"[OK] Bucket '{BUCKET}' already exists in your account.")
    elif code == "BucketAlreadyExists":
        print(f"[FAIL] '{BUCKET}' is owned by someone else (S3 names are globally unique).")
        print("       Try a more unique name like green-ledger-ai-shivang or greenledger-{your-username}")
        sys.exit(1)
    elif code == "AccessDenied":
        print(f"[FAIL] AccessDenied: IAM user lacks s3:CreateBucket.")
        print(f"       Detail: {msg}")
        print("       You'll need to create it via the AWS Console: https://s3.console.aws.amazon.com/s3/")
        sys.exit(1)
    else:
        print(f"[FAIL] {code}: {msg}")
        sys.exit(1)

# Verify by listing it
try:
    client.head_bucket(Bucket=BUCKET)
    print(f"[OK] HeadBucket confirmed: '{BUCKET}' is reachable.")
except ClientError as e:
    print(f"[WARN] Created but HeadBucket failed: {e}")
