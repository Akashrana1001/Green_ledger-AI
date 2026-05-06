"""
InsightGenerator — the 6th node in the document-processing pipeline.

Runs AFTER calculate_kpis() and BEFORE the Node.js sync.
Feeds the freshly calculated KPIs into the LLM and asks it to act as a
Chief Sustainability Officer, returning 3 actionable, metric-specific insights.

LOCAL_MODE : uses Ollama (text-only) via the shared serialisation lock
AWS mode   : uses AWS Bedrock Claude 3 Haiku via boto3
"""
import json
import os

from prompts.extraction_prompts import INSIGHT_PROMPT_TEMPLATE

# ── Human-readable labels & units for metric keys ─────────────────────────────
METRIC_LABELS: dict[str, tuple[str, str]] = {
    # Energy
    "total_energy_kwh":            ("Total Energy Consumed",              "kWh"),
    "total_energy_gj":             ("Total Energy Consumed",              "GJ"),
    "renewable_energy_pct":        ("Renewable Energy Share",             "%"),
    "renewable_energy_gj":         ("Renewable Energy Volume",            "GJ"),
    "energy_intensity_per_rupee":  ("Energy Intensity per Revenue",       "kWh/INR"),
    # GHG
    "scope1_tco2e":                ("Scope 1 GHG Emissions",              "tCO₂e"),
    "scope2_tco2e":                ("Scope 2 GHG Emissions",              "tCO₂e"),
    "scope3_tco2e":                ("Scope 3 GHG Emissions",              "tCO₂e"),
    "ghg_intensity_ppp":           ("GHG Intensity (PPP-adjusted)",       "tCO₂e / INR Cr"),
    "ghg_intensity_per_rupee":     ("GHG Intensity per Revenue",          "tCO₂e / INR"),
    # Water
    "total_water_kl":              ("Total Water Consumed",               "KL"),
    "water_recycled_pct":          ("Water Recycled / Recovered",         "%"),
    "water_intensity":             ("Water Intensity per Revenue",        "KL / INR Cr"),
    "water_withdrawal_surface_kl": ("Surface Water Withdrawal",           "KL"),
    "water_withdrawal_ground_kl":  ("Groundwater Withdrawal",             "KL"),
    "water_discharged_kl":         ("Water Discharged",                   "KL"),
    # Waste
    "total_waste_mt":              ("Total Waste Generated",              "MT"),
    "waste_recovered_pct":         ("Waste Recovered / Recycled",         "%"),
    "hazardous_waste_mt":          ("Hazardous Waste",                    "MT"),
    "non_hazardous_waste_mt":      ("Non-Hazardous Waste",                "MT"),
    "plastic_waste_mt":            ("Plastic Waste",                      "MT"),
    "waste_landfill_mt":           ("Waste Sent to Landfill",             "MT"),
    "waste_incinerated_mt":        ("Waste Incinerated",                  "MT"),
    # Air emissions
    "nox_mt":                      ("NOx Emissions",                      "MT"),
    "sox_mt":                      ("SOx Emissions",                      "MT"),
    "pm_mt":                       ("Particulate Matter Emissions",       "MT"),
    "voc_mt":                      ("VOC Emissions",                      "MT"),
    # Social
    "female_wage_pct":             ("Female Wage Equity",                 "% of total wages"),
    "wellbeing_spend_pct_revenue": ("Employee Wellbeing Spend",           "% of revenue"),
    "ltifr_employees":             ("LTIFR — Employees",                  "per million hours"),
    "ltifr_workers":               ("LTIFR — Workers",                    "per million hours"),
    "safety_training_pct":         ("Safety Training Coverage",           "%"),
    "msme_procurement_pct":        ("MSME Procurement Share",             "% of purchases"),
    "median_wage_ratio":           ("Gender Pay Ratio (F/M)",             "ratio"),
    "posh_complaints_count":       ("POSH Complaints Filed",              "count"),
    # Governance
    "data_breach_pct_incidents":   ("Data Breach Rate",                   "% of cyber events"),
    "accounts_payable_days":       ("Days Payable Outstanding",           "days"),
    "regulatory_fines_inr":        ("Regulatory Fines",                   "INR"),
    "anti_competitive_cases":      ("Anti-Competitive Cases",             "count"),
}


def _format_metrics(kpis: dict) -> str:
    """Convert the KPI dict to a numbered list of human-readable metric lines."""
    lines = []
    for key, value in kpis.items():
        if value is None or value == 0:
            continue
        label, unit = METRIC_LABELS.get(key, (key.replace("_", " ").title(), ""))
        line = f"  - {label}: {value:,.4g} {unit}".rstrip()
        lines.append(line)
    return "\n".join(lines) if lines else "  (no non-zero metrics available)"


def _parse_insights(raw_text: str) -> list[dict]:
    """
    Robustly extract a JSON array from the LLM response.
    Validates that each item has the 4 required keys.
    Returns at most 3 validated insights.
    """
    start = raw_text.find("[")
    end   = raw_text.rfind("]") + 1
    if start == -1 or end == 0:
        print(f"[InsightGenerator] No JSON array found in response: {raw_text!r:.200}", flush=True)
        return []
    try:
        raw_list = json.loads(raw_text[start:end])
    except json.JSONDecodeError as exc:
        print(f"[InsightGenerator] JSON parse error: {exc}", flush=True)
        return []

    required = {"category", "title", "description", "estimated_impact"}
    valid = []
    for item in raw_list[:3]:
        if isinstance(item, dict) and required.issubset(item.keys()):
            valid.append({
                "category":         str(item["category"]).lower().strip(),
                "title":            str(item["title"]).strip(),
                "description":      str(item["description"]).strip(),
                "estimated_impact": str(item["estimated_impact"]).strip(),
            })
    return valid


def _call_ollama(prompt: str) -> str:
    """Delegate to the shared generate_text helper in ollama_client."""
    from services.ollama_client import generate_text
    return generate_text(prompt)


def _call_bedrock(prompt: str) -> str:
    """
    Call AWS Bedrock Claude Haiku with a text prompt; returns raw string.

    Uses the explicit AWS_BEDROCK_* credential set. Raises if any required
    env var is missing or the credentials are rejected — the caller
    (generate_insights) catches every exception and returns [] so the
    main pipeline is never blocked.
    """
    import boto3
    from botocore.exceptions import (
        ClientError, NoCredentialsError, EndpointConnectionError,
    )

    region   = os.environ.get("AWS_BEDROCK_REGION", "ap-south-1")
    model_id = os.environ.get("BEDROCK_MODEL_HAIKU", "anthropic.claude-3-haiku-20240307-v1:0")

    access_key   = os.environ.get("AWS_BEDROCK_ACCESS_KEY_ID")
    secret_key   = os.environ.get("AWS_BEDROCK_SECRET_ACCESS_KEY")
    session_tok  = os.environ.get("AWS_BEDROCK_SESSION_TOKEN") or None  # blank → None

    if not access_key or not secret_key:
        raise RuntimeError("AWS_BEDROCK_ACCESS_KEY_ID / SECRET not configured")

    client = boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=session_tok,
    )
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 900,
        "messages": [{"role": "user", "content": prompt}],
    })

    try:
        response = client.invoke_model(modelId=model_id, body=body)
    except (ClientError, NoCredentialsError, EndpointConnectionError) as e:
        # Re-raise as a clean RuntimeError so generate_insights logs one line
        # instead of a multi-line botocore traceback
        raise RuntimeError(f"Bedrock invoke failed: {type(e).__name__}: {e}") from e

    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def generate_insights(
    brsr_category: str,
    calculated_kpis: dict,
    use_local: bool | None = None,
) -> list[dict]:
    """
    Feed calculated KPIs into the LLM and return ≤3 actionable insights.

    Args:
        brsr_category:    e.g. 'electricity_bill' — used as context label.
        calculated_kpis:  Output of kpi_calculator.calculate_kpis().
        use_local:        Routing decision from process.py. If None, falls back
                          to .env LOCAL_MODE. The UI toggle is the source of
                          truth — passing it explicitly prevents the mismatch
                          where .env says AWS but the UI requested Ollama
                          (or vice-versa), which previously caused
                          UnrecognizedClientException to crash insights.

    Returns:
        List of dicts [{ category, title, description, estimated_impact, formula_used? }].
        ALWAYS returns a list. Returns [] on any failure — never raises.
        The verified document sync to Node.js proceeds even when insights are
        empty, so KPIs reach the dashboard even if Bedrock is offline.
    """
    if not calculated_kpis:
        return []

    # Routing — explicit param wins; env LOCAL_MODE is the fallback default
    if use_local is None:
        use_local = os.environ.get("LOCAL_MODE", "").strip().lower() == "true"

    target = "Ollama (local)" if use_local else "AWS Bedrock"
    print(f"[InsightGenerator] Generating insights for '{brsr_category}' via {target}...", flush=True)

    try:
        metrics_lines = _format_metrics(calculated_kpis)
        prompt = INSIGHT_PROMPT_TEMPLATE.format(
            category=brsr_category.replace("_", " ").title(),
            metrics_lines=metrics_lines,
        )

        raw = _call_ollama(prompt) if use_local else _call_bedrock(prompt)
        insights = _parse_insights(raw)
        print(f"[InsightGenerator] Generated {len(insights)} insight(s)", flush=True)
        return insights

    except Exception as exc:
        # Catch-all — never block the verified sync. Bedrock auth errors,
        # Ollama timeouts, JSON parse errors, anything else: log one line,
        # return empty list, let the dashboard show KPIs without insights.
        print(
            f"[InsightGenerator] Skipped (non-fatal): {type(exc).__name__}: {exc}. "
            f"Document KPIs will still sync to dashboard.",
            flush=True,
        )
        return []
