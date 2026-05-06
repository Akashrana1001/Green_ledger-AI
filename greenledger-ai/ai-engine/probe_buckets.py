"""Probe likely bucket names with HeadBucket — works even without ListAllMyBuckets."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

import boto3
from botocore.exceptions import ClientError

CANDIDATES = [
    "green-ledger-ai",
    "greenledger-documents",
    "greenledger-ai",
    "greenledger",
    "green-ledger",
    "greenledgerai",
    "green-ledger-AI",  # invalid but let's confirm
]

client = boto3.client(
    "s3",
    region_name=os.environ["AWS_S3_REGION"],
    aws_access_key_id=os.environ["AWS_S3_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_S3_SECRET_ACCESS_KEY"],
)

found = []
for name in CANDIDATES:
    try:
        client.head_bucket(Bucket=name)
        print(f"  [EXISTS    ]{name}")
        found.append(name)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "?")
        if code == "404":
            print(f"  [missing   ]{name}")
        elif code == "403":
            print(f"  [! forbidden] {name}  (exists but you lack access OR owned by another account)")
        elif code == "400":
            print(f"  [! bad name]  {name}  (invalid S3 name)")
        else:
            print(f"  [? error {code}] {name}")

if found:
    print(f"\n>>> USE THIS BUCKET NAME: {found[0]}")
else:
    print("\n>>> No matching bucket found. Create one with:")
    print("    aws s3 mb s3://green-ledger-ai --region us-east-1")
