"""
AWS SNS client — ESG compliance alert publisher.
Reads credentials from env; uses the same personal-AWS account as S3
(AWS_S3_ACCESS_KEY_ID / AWS_S3_SECRET_ACCESS_KEY) unless dedicated
AWS_SNS_* vars are set.

All calls are fire-and-forget: failures are logged but never raised so
they cannot interrupt the main processing pipeline.
"""
import os

import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────
TOPIC_ARN   = os.environ.get("AWS_SNS_TOPIC_ARN", "")
REGION      = os.environ.get("AWS_SNS_REGION", os.environ.get("AWS_S3_REGION", "us-east-1"))
# Prefer dedicated SNS keys; fall back to S3 keys (same personal AWS account)
ACCESS_KEY    = os.environ.get("AWS_SNS_ACCESS_KEY_ID",     os.environ.get("AWS_S3_ACCESS_KEY_ID", ""))
SECRET_KEY    = os.environ.get("AWS_SNS_SECRET_ACCESS_KEY", os.environ.get("AWS_S3_SECRET_ACCESS_KEY", ""))
SESSION_TOKEN = os.environ.get("AWS_SNS_SESSION_TOKEN",    os.environ.get("AWS_S3_SESSION_TOKEN")) or None
FRONTEND_URL        = os.environ.get("FRONTEND_URL", "http://localhost:3000")
ACTIONABLE_PLANS_URL = f"{FRONTEND_URL}/admin/war-room/actionable-plans"

# ── Threshold constants ───────────────────────────────────────────────────────
GHG_ALERT_THRESHOLD_TCO2E = float(os.environ.get("GHG_ALERT_THRESHOLD_TCO2E", "10000"))


# ── Public API ────────────────────────────────────────────────────────────────

def send_esg_alert(
    subject: str,
    message: str,
    alert_type: str,
    document_name: str = "",
    kpi_name: str = "",
    kpi_value: str = "",
) -> bool:
    """
    Publish an ESG compliance alert to the configured AWS SNS topic.

    Parameters
    ----------
    subject      : Email/SMS subject line (truncated to 100 chars per SNS limit).
    message      : Human-readable body explaining the alert.
    alert_type   : One of: "ghg_threshold" | "data_breach" | "verification".
    document_name: Filename of the processed document (for context).
    kpi_name     : KPI label that triggered the alert (e.g. "Scope 1 GHG").
    kpi_value    : Formatted value with units (e.g. "12,746 tCO₂e").

    Returns True on successful publish, False if SNS is unconfigured or an
    error occurs.
    """
    if not TOPIC_ARN:
        print("[SNS] AWS_SNS_TOPIC_ARN not set — alert skipped", flush=True)
        return False

    body = _build_message_body(message, document_name, kpi_name, kpi_value, alert_type)

    try:
        client = boto3.client(
            "sns",
            region_name=REGION,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
            aws_session_token=SESSION_TOKEN,
        )
        client.publish(
            TopicArn=TOPIC_ARN,
            Subject=subject[:100],
            Message=body,
            MessageAttributes={
                "alert_type": {
                    "DataType": "String",
                    "StringValue": alert_type,
                }
            },
        )
        print(f"[SNS] Published alert: type={alert_type!r} subject={subject!r}", flush=True)
        return True
    except ClientError as exc:
        print(f"[SNS] ClientError: {exc}", flush=True)
        return False
    except Exception as exc:
        print(f"[SNS] Unexpected error: {exc}", flush=True)
        return False


def check_and_send_threshold_alerts(
    kpis: dict,
    document_name: str,
    brsr_category: str,
) -> None:
    """
    Inspect the freshly-calculated KPI dict and fire SNS alerts for any
    values that exceed compliance thresholds.

    Called immediately after kpi_calculator.calculate_kpis() returns.
    All alerts are non-blocking (failures are logged, not raised).
    """
    env_kpis = kpis.get("environmental", {})
    gov_kpis = kpis.get("governance", {})

    # ── 1. Scope 1 GHG threshold ──────────────────────────────────────────────
    scope1 = env_kpis.get("scope1_tco2e")
    if scope1 is not None and scope1 > GHG_ALERT_THRESHOLD_TCO2E:
        send_esg_alert(
            subject=f"[GreenLedger ALERT] Scope 1 GHG exceeds {GHG_ALERT_THRESHOLD_TCO2E:,.0f} tCO₂e",
            message=(
                f"Scope 1 GHG emissions of {scope1:,.1f} tCO₂e exceed the compliance "
                f"threshold of {GHG_ALERT_THRESHOLD_TCO2E:,.0f} tCO₂e.\n\n"
                f"Immediate review of fuel and process emission sources is recommended."
            ),
            alert_type="ghg_threshold",
            document_name=document_name,
            kpi_name="Scope 1 GHG",
            kpi_value=f"{scope1:,.1f} tCO₂e",
        )

    # ── 2. Scope 2 GHG threshold ──────────────────────────────────────────────
    scope2 = env_kpis.get("scope2_tco2e")
    if scope2 is not None and scope2 > GHG_ALERT_THRESHOLD_TCO2E:
        send_esg_alert(
            subject=f"[GreenLedger ALERT] Scope 2 GHG exceeds {GHG_ALERT_THRESHOLD_TCO2E:,.0f} tCO₂e",
            message=(
                f"Scope 2 GHG emissions of {scope2:,.1f} tCO₂e exceed the compliance "
                f"threshold of {GHG_ALERT_THRESHOLD_TCO2E:,.0f} tCO₂e.\n\n"
                f"Evaluate switching to renewable energy procurement (PPA/RECs) to reduce "
                f"grid-electricity-based emissions."
            ),
            alert_type="ghg_threshold",
            document_name=document_name,
            kpi_name="Scope 2 GHG",
            kpi_value=f"{scope2:,.1f} tCO₂e",
        )

    # ── 3. Data breach governance alert ───────────────────────────────────────
    breach_pct = gov_kpis.get("data_breach_pct_incidents")
    if breach_pct is not None and breach_pct > 0:
        send_esg_alert(
            subject="[GreenLedger CRITICAL] Data breach incidents detected",
            message=(
                f"Data breach incidents detected: {breach_pct:.2f}% of total cyber events "
                f"classified as breaches.\n\n"
                f"This is a SEBI BRSR Principle 8 governance risk. Immediate escalation to "
                f"the CISO and board-level Data Privacy Committee is required."
            ),
            alert_type="data_breach",
            document_name=document_name,
            kpi_name="Data Breach %",
            kpi_value=f"{breach_pct:.2f}%",
        )


def send_verification_alert(document_name: str, brsr_category: str, kpi_count: int) -> None:
    """
    Notify admin that a document has been successfully verified and KPIs are live.
    Called after _sync_to_node reports status='verified'.
    """
    send_esg_alert(
        subject=f"[GreenLedger] Document Verified: {document_name}",
        message=(
            f"Document '{document_name}' has been successfully processed and verified.\n\n"
            f"  BRSR Category : {brsr_category}\n"
            f"  KPIs Calculated: {kpi_count}\n\n"
            f"The verified metrics are now live on the dashboard. Review the AI-generated "
            f"actionable insights for compliance recommendations."
        ),
        alert_type="verification",
        document_name=document_name,
        kpi_name="KPIs Calculated",
        kpi_value=str(kpi_count),
    )


# ── Private helper ────────────────────────────────────────────────────────────

def _build_message_body(
    message: str,
    document_name: str,
    kpi_name: str,
    kpi_value: str,
    alert_type: str,
) -> str:
    divider = "─" * 52
    lines = [
        divider,
        "  GreenLedger AI — ESG Compliance Alert",
        divider,
        "",
        f"  Alert Type  : {alert_type.replace('_', ' ').title()}",
    ]
    if document_name:
        lines.append(f"  Document    : {document_name}")
    if kpi_name and kpi_value:
        lines.append(f"  KPI         : {kpi_name} = {kpi_value}")
    lines += [
        "",
        "  Details:",
        *[f"  {line}" for line in message.split("\n")],
        "",
        divider,
        f"  View Actionable Plans:",
        f"  {ACTIONABLE_PLANS_URL}",
        divider,
        "",
        "  Sent by GreenLedger AI · SEBI BRSR Compliance Platform",
    ]
    return "\n".join(lines)
