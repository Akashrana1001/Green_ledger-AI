"""
Enterprise Compliance Data Extraction prompts — one per BRSR category.

ROLE:
    You are an Enterprise Compliance Data Extraction Agent processing
    official regulatory documents (SEBI BRSR reports, audited statements,
    utility bills, HR registers). Output is consumed by an audit-ready
    corporate dashboard, so accuracy is mandatory for legal compliance.

DATA GAP PROTOCOL — applies to EVERY category, EVERY field:
    1. Output one JSON object. No prose, no fences, no thinking tags.
    2. If a value is missing, blank, ambiguous, or NOT EXPLICITLY stated
       in the source text, output the exact string "DATA_NOT_FOUND".
       Never output null, "N/A", "-", "—", "Not Available", or empty string.
    3. NEVER hallucinate, infer, guess, or use external knowledge.
       NEVER default to 0 — only emit 0 when the text explicitly says
       "zero" / "nil" / "0".
    4. Extract values exactly as stated, but stripped of commas and units:
       "1,200 metric tonnes" → 1200,  "₹500 Cr" → 500,  "88%" → 88
    5. Numbers are bare numerics; strings are bare strings.

Absolute zero tolerance for hallucinated data. If it is not on the page,
it does not exist — emit DATA_NOT_FOUND and let the dashboard prompt
the human reviewer to fill it in.
"""

# ── Shared preamble (cuts repetition across 17 categories) ────────────────
_GREEDY_PREAMBLE = (
    "You are an Enterprise Compliance Data Extraction Agent. The input is "
    "an official regulatory document (SEBI BRSR report, audited statement, "
    "utility bill, HR register, etc.). Your output feeds a corporate "
    "compliance dashboard, so it must be 100% auditable.\n\n"
    "DATA GAP PROTOCOL (CRITICAL):\n"
    "  • If a requested field is missing, blank, ambiguous, or not "
    "EXPLICITLY stated in the text, output the exact string "
    "\"DATA_NOT_FOUND\" for that field.\n"
    "  • NEVER hallucinate, infer, guess, default to 0, or use external "
    "knowledge. If it is not on the page, it does not exist.\n"
    "  • Only emit 0 when the document explicitly says \"zero\" / \"nil\" "
    "/ \"0\". A blank cell is NOT zero — it is DATA_NOT_FOUND.\n"
    "  • Extract values exactly as stated (e.g. \"1,200 metric tonnes\" → "
    "1200; strip commas and units).\n\n"
    "EXTRACTION RULES:\n"
    "  • Scan aggressively for the concepts below — values can appear "
    "inline (e.g. \"scope 1 is 1240\", \"wage parity 88%\"); map fuzzy "
    "phrasings to the exact JSON key."
)

_OUTPUT_RULE = (
    "Return ONLY a single valid JSON object — no prose, no markdown "
    "fences, no <thinking> tags. Start with { and end with }. "
    "Every key in the schema MUST appear in the output, with either a "
    "valid value or the string \"DATA_NOT_FOUND\"."
)


def _build(schema: str, hints: str) -> str:
    return (
        f"{_GREEDY_PREAMBLE}\n\n"
        f"Schema — every key MUST appear; use \"DATA_NOT_FOUND\" if missing:\n"
        f"{schema}\n\n"
        f"Fuzzy keyword map — recognise any of these synonyms:\n{hints}\n\n"
        f"{_OUTPUT_RULE}"
    )


EXTRACTION_PROMPTS: dict[str, str] = {

    # ── ENVIRONMENTAL ─────────────────────────────────────────────────────
    "electricity_bill": _build(
        '{"kwh_consumed": number|"DATA_NOT_FOUND", "billing_period_months": number|"DATA_NOT_FOUND", "state": string|"DATA_NOT_FOUND"}',
        '- kwh_consumed: "kWh", "units consumed", "energy used", "electricity drawn"\n'
        '- billing_period_months: "billing cycle", "period", "for the month(s) of"\n'
        '- state: any Indian state name in the address block'
    ),

    "fuel_consumption": _build(
        '{"diesel_liters": number|"DATA_NOT_FOUND", "petrol_liters": number|"DATA_NOT_FOUND", '
        '"lpg_kg": number|"DATA_NOT_FOUND", "cng_kg": number|"DATA_NOT_FOUND", '
        '"period_months": number|"DATA_NOT_FOUND", "scope1_tco2e": number|"DATA_NOT_FOUND"}',
        '- diesel_liters: "diesel", "HSD", "DG set fuel", "litres of diesel"\n'
        '- petrol_liters: "petrol", "gasoline", "MS"\n'
        '- lpg_kg: "LPG", "cooking gas", "propane"\n'
        '- cng_kg: "CNG", "compressed natural gas"\n'
        '- scope1_tco2e: "Scope 1", "scope-1 emissions", "direct emissions", '
        '"tCO2e from combustion", "stationary combustion CO2" — ALWAYS extract '
        'this if a Scope 1 number is mentioned, even if fuel breakdown is missing'
    ),

    "water_usage": _build(
        '{"kiloliters_consumed": number|"DATA_NOT_FOUND", "recycled_kl": number|"DATA_NOT_FOUND", '
        '"period_months": number|"DATA_NOT_FOUND"}',
        '- kiloliters_consumed: "KL", "kilolitres", "water withdrawn", '
        '"freshwater used", "m3" (treat 1 m3 = 1 KL)\n'
        '- recycled_kl: "recycled", "reused", "treated water reused", "STP output"'
    ),

    "waste_records": _build(
        '{"total_waste_mt": number|"DATA_NOT_FOUND", "recovered_mt": number|"DATA_NOT_FOUND", '
        '"period_months": number|"DATA_NOT_FOUND"}',
        '- total_waste_mt: "waste generated", "MT", "metric tonnes", "tonnes of waste"\n'
        '- recovered_mt: "recovered", "recycled", "reused", "diverted from landfill"'
    ),

    "air_emissions_log": _build(
        '{"nox_mt": number|"DATA_NOT_FOUND", "sox_mt": number|"DATA_NOT_FOUND", "pm_mt": number|"DATA_NOT_FOUND", '
        '"pop_mt": number|"DATA_NOT_FOUND", "voc_mt": number|"DATA_NOT_FOUND", "hap_mt": number|"DATA_NOT_FOUND"}',
        '- nox_mt: "NOx", "nitrogen oxides"\n'
        '- sox_mt: "SOx", "sulphur oxides", "SO2"\n'
        '- pm_mt: "PM", "particulate matter", "PM2.5", "PM10"\n'
        '- voc_mt: "VOC", "volatile organic compounds"\n'
        '- pop_mt: "POP", "persistent organic pollutants"\n'
        '- hap_mt: "HAP", "hazardous air pollutants"'
    ),

    "scope3_emissions_data": _build(
        '{"scope3_tco2e": number|"DATA_NOT_FOUND", "business_travel_tco2e": number|"DATA_NOT_FOUND", '
        '"supply_chain_tco2e": number|"DATA_NOT_FOUND"}',
        '- scope3_tco2e: "Scope 3", "scope-3 emissions", "value chain emissions", '
        '"indirect emissions other than purchased energy"\n'
        '- business_travel_tco2e: "travel emissions", "category 6", "business travel"\n'
        '- supply_chain_tco2e: "purchased goods", "category 1", "upstream emissions"'
    ),

    # ── SOCIAL ────────────────────────────────────────────────────────────
    "hr_wages_data": _build(
        '{"total_wages": number|"DATA_NOT_FOUND", "female_wages": number|"DATA_NOT_FOUND", '
        '"small_town_wages": number|"DATA_NOT_FOUND", "wellbeing_spend": number|"DATA_NOT_FOUND", '
        '"total_revenue": number|"DATA_NOT_FOUND", "female_wage_pct": number|"DATA_NOT_FOUND", '
        '"small_town_wage_pct": number|"DATA_NOT_FOUND", "wellbeing_spend_pct": number|"DATA_NOT_FOUND"}',
        '- total_wages: "total payroll", "wage bill", "remuneration paid"\n'
        '- female_wages: "wages paid to women", "female remuneration"\n'
        '- small_town_wages: "tier-2/tier-3 wages", "non-metro wages", '
        '"wages in small towns"\n'
        '- wellbeing_spend: "well-being spend", "employee wellness budget", '
        '"insurance + benefits cost"\n'
        '- total_revenue: "turnover", "revenue", "sales"\n'
        '- female_wage_pct: "female-to-male wage parity", "female wage %", '
        '"women wages as % of total", "wage parity ratio" — extract this DIRECTLY '
        'as a percentage if the document already gives a ratio (e.g. "88%")\n'
        '- small_town_wage_pct: "small town wages as % of total", "tier-2/3 share"\n'
        '- wellbeing_spend_pct: "well-being spend as % of revenue", '
        '"wellness budget % of turnover"'
    ),

    "supplier_msme_cert": _build(
        '{"msme_spend": number|"DATA_NOT_FOUND", "total_purchases": number|"DATA_NOT_FOUND", '
        '"msme_procurement_pct": number|"DATA_NOT_FOUND"}',
        '- msme_spend: "MSME spend", "small supplier purchases", "Udyam-registered spend"\n'
        '- total_purchases: "total procurement", "vendor spend"\n'
        '- msme_procurement_pct: "MSME % of total purchases", "small-supplier share"'
    ),

    "posh_records": _build(
        '{"posh_complaints_count": number|"DATA_NOT_FOUND"}',
        '- posh_complaints_count: "POSH", "sexual harassment complaints", '
        '"Internal Committee filings"'
    ),

    "safety_incidents_log": _build(
        '{"ltifr_employees": number|"DATA_NOT_FOUND", "ltifr_workers": number|"DATA_NOT_FOUND", '
        '"fatalities_employees": number|"DATA_NOT_FOUND", "fatalities_workers": number|"DATA_NOT_FOUND", '
        '"total_recordable_injuries_employees": number|"DATA_NOT_FOUND", '
        '"total_recordable_injuries_workers": number|"DATA_NOT_FOUND", '
        '"safety_training_pct": number|"DATA_NOT_FOUND"}',
        '- ltifr_*: "LTIFR", "Lost Time Injury Frequency Rate", "per million man-hours"\n'
        '- fatalities_*: "fatal accidents", "deaths on duty"\n'
        '- total_recordable_injuries_*: "TRI", "recordable injuries"\n'
        '- safety_training_pct: "% trained on safety", "safety training coverage"'
    ),

    "workforce_records": _build(
        '{"permanent_employees_total": number|"DATA_NOT_FOUND", "permanent_employees_male": number|"DATA_NOT_FOUND", '
        '"permanent_employees_female": number|"DATA_NOT_FOUND", "other_employees_total": number|"DATA_NOT_FOUND", '
        '"permanent_workers_total": number|"DATA_NOT_FOUND", "permanent_workers_male": number|"DATA_NOT_FOUND", '
        '"permanent_workers_female": number|"DATA_NOT_FOUND", "other_workers_total": number|"DATA_NOT_FOUND", '
        '"contract_employees_total": number|"DATA_NOT_FOUND", "differently_abled_employees": number|"DATA_NOT_FOUND", '
        '"differently_abled_workers": number|"DATA_NOT_FOUND", "median_wage_male_inr": number|"DATA_NOT_FOUND", '
        '"median_wage_female_inr": number|"DATA_NOT_FOUND", "women_in_board_pct": number|"DATA_NOT_FOUND", '
        '"women_in_kmp_pct": number|"DATA_NOT_FOUND", "turnover_rate_male": number|"DATA_NOT_FOUND", '
        '"turnover_rate_female": number|"DATA_NOT_FOUND", "union_membership_pct": number|"DATA_NOT_FOUND", '
        '"human_rights_training_pct": number|"DATA_NOT_FOUND"}',
        '- permanent_*: "permanent staff", "on-rolls", "regular employees/workers"\n'
        '- other_*: "contract", "casual", "third-party payroll"\n'
        '- differently_abled_*: "PwD", "persons with disabilities"\n'
        '- median_wage_*_inr: "median pay", "median remuneration"\n'
        '- women_in_board_pct / women_in_kmp_pct: "% women on board", '
        '"% female KMP"\n'
        '- turnover_rate_*: "attrition rate", "% left during year"\n'
        '- union_membership_pct: "unionised %", "trade-union coverage"\n'
        '- human_rights_training_pct: "% trained on human rights"'
    ),

    "employee_benefits": _build(
        '{"health_insurance_employees_pct": number|"DATA_NOT_FOUND", "health_insurance_workers_pct": number|"DATA_NOT_FOUND", '
        '"accident_insurance_employees_pct": number|"DATA_NOT_FOUND", "accident_insurance_workers_pct": number|"DATA_NOT_FOUND", '
        '"maternity_benefits_pct": number|"DATA_NOT_FOUND", "paternity_benefits_pct": number|"DATA_NOT_FOUND", '
        '"daycare_facilities_pct": number|"DATA_NOT_FOUND", "pf_coverage_pct": number|"DATA_NOT_FOUND", '
        '"gratuity_coverage_pct": number|"DATA_NOT_FOUND", "esi_coverage_pct": number|"DATA_NOT_FOUND", '
        '"wellbeing_spend_pct_revenue": number|"DATA_NOT_FOUND"}',
        '- health_insurance_*_pct: "health insurance coverage", "% covered by mediclaim"\n'
        '- accident_insurance_*_pct: "accident cover", "personal accident insurance"\n'
        '- maternity_benefits_pct / paternity_benefits_pct: "maternity/paternity coverage %"\n'
        '- daycare_facilities_pct: "creche", "daycare provided"\n'
        '- pf_coverage_pct / gratuity_coverage_pct / esi_coverage_pct: '
        '"PF/EPF coverage", "gratuity coverage", "ESI coverage"\n'
        '- wellbeing_spend_pct_revenue: "% of revenue spent on insurance/well-being", '
        '"wellness as % of turnover", "employee wellbeing spend ratio" — capture '
        'this DIRECTLY when the document states a percentage'
    ),

    "consumer_complaints": _build(
        '{"data_privacy_complaints": number|"DATA_NOT_FOUND", "advertising_complaints": number|"DATA_NOT_FOUND", '
        '"cyber_security_complaints": number|"DATA_NOT_FOUND", "essential_services_complaints": number|"DATA_NOT_FOUND", '
        '"restrictive_trade_complaints": number|"DATA_NOT_FOUND", "unfair_trade_complaints": number|"DATA_NOT_FOUND", '
        '"product_recall_voluntary": number|"DATA_NOT_FOUND", "product_recall_forced": number|"DATA_NOT_FOUND"}',
        '- *_complaints: "complaints filed", "grievances received under <topic>"\n'
        '- product_recall_voluntary / product_recall_forced: "voluntary recall", '
        '"forced recall", "regulator-mandated recall"'
    ),

    # ── GOVERNANCE ────────────────────────────────────────────────────────
    "governance_report": _build(
        '{"related_party_purchases": number|"DATA_NOT_FOUND", "total_purchases": number|"DATA_NOT_FOUND", '
        '"related_party_sales": number|"DATA_NOT_FOUND", "total_sales": number|"DATA_NOT_FOUND", '
        '"regulatory_fines_count": number|"DATA_NOT_FOUND", "regulatory_fines_inr": number|"DATA_NOT_FOUND", '
        '"anti_competitive_cases": number|"DATA_NOT_FOUND", "conflict_of_interest_complaints": number|"DATA_NOT_FOUND", '
        '"related_party_buy_pct": number|"DATA_NOT_FOUND", "data_breach_pct": number|"DATA_NOT_FOUND"}',
        '- related_party_purchases / sales: "RPT", "related party transactions"\n'
        '- regulatory_fines_*: "penalties imposed", "fines paid", "regulator action"\n'
        '- anti_competitive_cases: "CCI cases", "anti-trust filings"\n'
        '- conflict_of_interest_complaints: "COI complaints", "ethics line cases"\n'
        '- related_party_buy_pct: "RPT purchases as % of total purchases"\n'
        '- data_breach_pct: "% of cyber events resulting in breach"'
    ),

    "accounts_payable": _build(
        '{"accounts_payable": number|"DATA_NOT_FOUND", "cogs": number|"DATA_NOT_FOUND", '
        '"payable_days": number|"DATA_NOT_FOUND"}',
        '- accounts_payable: "AP", "trade payables", "creditors", "amount payable to vendors"\n'
        '- cogs: "cost of goods sold", "cost of materials consumed", "COGS"\n'
        '- payable_days: "DPO", "days payable outstanding", "supplier-payment days" '
        '— extract DIRECTLY if the document already states a day count'
    ),

    "cyber_security_log": _build(
        '{"breach_incidents": number|"DATA_NOT_FOUND", "total_cyber_events": number|"DATA_NOT_FOUND", '
        '"data_breach_pct": number|"DATA_NOT_FOUND"}',
        '- breach_incidents: "confirmed data breaches", "incidents with data loss"\n'
        '- total_cyber_events: "total cyber alerts", "security events", "SIEM events"\n'
        '- data_breach_pct: "breaches as % of events"'
    ),

    # ── FINANCIAL / GENERAL ───────────────────────────────────────────────
    "financial_statements": _build(
        '{"revenue_inr_crore": number|"DATA_NOT_FOUND", "total_energy_gj": number|"DATA_NOT_FOUND", '
        '"renewable_energy_gj": number|"DATA_NOT_FOUND", '
        '"water_withdrawal_surface_kl": number|"DATA_NOT_FOUND", "water_withdrawal_ground_kl": number|"DATA_NOT_FOUND", '
        '"water_withdrawal_third_party_kl": number|"DATA_NOT_FOUND", "water_discharged_kl": number|"DATA_NOT_FOUND", '
        '"hazardous_waste_mt": number|"DATA_NOT_FOUND", "non_hazardous_waste_mt": number|"DATA_NOT_FOUND", '
        '"plastic_waste_mt": number|"DATA_NOT_FOUND", "ewaste_mt": number|"DATA_NOT_FOUND", '
        '"bio_medical_waste_mt": number|"DATA_NOT_FOUND", "construction_waste_mt": number|"DATA_NOT_FOUND", '
        '"battery_waste_mt": number|"DATA_NOT_FOUND", "radioactive_waste_mt": number|"DATA_NOT_FOUND", '
        '"waste_recycled_mt": number|"DATA_NOT_FOUND", "waste_reused_mt": number|"DATA_NOT_FOUND", '
        '"waste_landfill_mt": number|"DATA_NOT_FOUND", "waste_incinerated_mt": number|"DATA_NOT_FOUND"}',
        '- revenue_inr_crore: "turnover", "revenue from operations", "₹ Cr"\n'
        '- total_energy_gj / renewable_energy_gj: "GJ", "gigajoules", '
        '"energy from renewables"\n'
        '- water_withdrawal_*: "surface water", "ground water", "third-party / municipal water"\n'
        '- *_waste_mt: standard waste-stream labels (hazardous, e-waste, plastic, etc.)'
    ),
}


# ── Insight generation prompt — used by InsightGenerator, NOT extraction ──
INSIGHT_PROMPT_TEMPLATE = """\
You are a Senior ESG Auditor and Strategic Consultant. Review the SEBI BRSR Core metrics below
and generate EXACTLY 3 mathematically-backed, actionable sustainability recommendations.

Document category: {category}
Verified metrics (use these exact numbers in your calculations):
{metrics_lines}

CALCULATION RULES — every insight MUST follow these:
- GHG reduction: State the exact tCO₂e figure (e.g. 10% of 12,628 tCO₂e = 1,262.8 tCO₂e).
- Energy savings: Use ₹8/kWh as the unit cost to compute INR savings.
- Water savings: Use ₹150/KL as the unit cost to compute INR savings.
- Waste diversion: Use ₹5,000/MT as avoided disposal cost.
- Intensity: If recommending emission cuts, state the new GHG intensity tCO₂e/Cr.
- Social: Express wage gap as exact percentage points and compute the salary increase %.
- Never round to a vague "15-20%" range — compute and give the single exact number.

Return ONLY a JSON array — no prose, no markdown fences, no <thinking> tags:
[
  {{
    "category": "<energy|water|waste|ghg|social|governance>",
    "title": "<action title, max 10 words>",
    "description": "<2 sentences: cite the exact baseline metric, then state the concrete action and result>",
    "estimated_impact": "<exact calculated result, e.g. -1,262.8 tCO₂e / ₹1.23 Cr saved>",
    "formula_used": "<the arithmetic expression, e.g. 10% × 12,628 tCO₂e = 1,262.8 tCO₂e>"
  }},
  {{ "category": "...", "title": "...", "description": "...", "estimated_impact": "...", "formula_used": "..." }},
  {{ "category": "...", "title": "...", "description": "...", "estimated_impact": "...", "formula_used": "..." }}
]"""
