"""
Deterministic SEBI BRSR Core KPI calculator.
The LLM extracts raw values only. ALL arithmetic happens here.

Architecture notes:
  1. _safe_float() — tolerates commas, currency symbols, trailing units in
     any string the LLM produces (e.g. "1,240", "₹500 Cr", "88%").
  2. _normalize_raw() — Key Normalizer.  Maps every fuzzy alias the LLM might
     return to the canonical key used by this file.  Run ONCE at the top of
     calculate_kpis(); the rest of the function only sees canonical keys.
  3. "Direct-override" pattern — if the LLM already returned a pre-computed
     percentage (e.g. female_wage_pct=88), use it directly and skip the
     component-level derivation.  Components are a fallback, not a requirement.
"""
import re

# ── CEA India Grid Emission Factors (tCO2e per MWh) — CEA CO2 Baseline DB ─────
GRID_EMISSION_FACTORS = {
    "Northern":     0.708,
    "Southern":     0.906,
    "Eastern":      1.004,
    "Western":      0.830,
    "Northeastern": 0.532,
    "default":      0.820,
}

STATE_TO_GRID = {
    "delhi": "Northern", "haryana": "Northern", "himachal pradesh": "Northern",
    "jammu": "Northern", "kashmir": "Northern", "punjab": "Northern",
    "rajasthan": "Northern", "uttar pradesh": "Northern", "uttarakhand": "Northern",
    "andhra pradesh": "Southern", "karnataka": "Southern", "kerala": "Southern",
    "puducherry": "Southern", "tamil nadu": "Southern", "telangana": "Southern",
    "bihar": "Eastern", "jharkhand": "Eastern", "odisha": "Eastern",
    "west bengal": "Eastern", "sikkim": "Eastern",
    "chhattisgarh": "Western", "goa": "Western", "gujarat": "Western",
    "madhya pradesh": "Western", "maharashtra": "Western",
    "arunachal pradesh": "Northeastern", "assam": "Northeastern",
    "manipur": "Northeastern", "meghalaya": "Northeastern",
    "mizoram": "Northeastern", "nagaland": "Northeastern", "tripura": "Northeastern",
}

FUEL_FACTORS = {
    "diesel_liters": 0.002641,
    "petrol_liters": 0.002289,
    "lpg_kg":        0.002983,
    "cng_kg":        0.002040,
}

PPP_FACTOR  = 23.5    # IMF India PPP conversion factor 2024: 1 USD = 23.5 PPP INR
KWH_TO_GJ   = 0.0036  # 1 kWh = 0.0036 GJ (exact)


# ── Key Normalizer alias table ─────────────────────────────────────────────────
# (fuzzy_key, canonical_key)  — first matching alias wins; canonical keys are
# never aliased (a key already in canonical form is returned as-is).
_KEY_ALIASES: list[tuple[str, str]] = [
    # ── Scope 1 (direct pre-computed result) ────────────────────────────
    ("scope_1_emissions",           "scope1_tco2e"),
    ("scope1_emissions",            "scope1_tco2e"),
    ("scope_1_tco2e",               "scope1_tco2e"),
    ("direct_emissions_tco2e",      "scope1_tco2e"),
    ("direct_ghg_tco2e",            "scope1_tco2e"),
    ("stationary_combustion_tco2e", "scope1_tco2e"),
    # ── Scope 2 ─────────────────────────────────────────────────────────
    ("scope_2_emissions",           "scope2_tco2e"),
    ("scope2_emissions",            "scope2_tco2e"),
    ("scope_2_tco2e",               "scope2_tco2e"),
    ("purchased_electricity_tco2e", "scope2_tco2e"),
    # ── Female wage ─────────────────────────────────────────────────────
    ("female_to_male_wage_parity",  "female_wage_pct"),
    ("female_wage_parity",          "female_wage_pct"),
    ("female_wage_ratio",           "female_wage_pct"),
    ("wage_parity_pct",             "female_wage_pct"),
    ("gender_pay_parity_pct",       "female_wage_pct"),
    ("women_wage_pct",              "female_wage_pct"),
    # ── Well-being spend ────────────────────────────────────────────────
    ("wellbeing_pct",               "wellbeing_spend_pct_revenue"),
    ("wellbeing_spend_pct",         "wellbeing_spend_pct_revenue"),
    ("well_being_spend_pct",        "wellbeing_spend_pct_revenue"),
    ("employee_wellbeing_pct",      "wellbeing_spend_pct_revenue"),
    ("wellness_pct_revenue",        "wellbeing_spend_pct_revenue"),
    # ── MSME ────────────────────────────────────────────────────────────
    ("msme_pct",                    "msme_procurement_pct"),
    ("msme_percentage",             "msme_procurement_pct"),
    ("msme_spend_pct",              "msme_procurement_pct"),
    # ── Revenue ─────────────────────────────────────────────────────────
    ("revenue_cr",                  "revenue_inr_crore"),
    ("turnover_inr_crore",          "revenue_inr_crore"),
    ("revenue_inr_crores",          "revenue_inr_crore"),
    ("total_revenue_crore",         "revenue_inr_crore"),
    # ── Accounts payable days ───────────────────────────────────────────
    ("dpo_days",                    "payable_days"),
    ("days_payable_outstanding",    "payable_days"),
    ("dpo",                         "payable_days"),
    # ── Data breach ─────────────────────────────────────────────────────
    ("data_breach_percentage",      "data_breach_pct"),
    ("breach_pct",                  "data_breach_pct"),
    ("data_breach_pct_incidents",   "data_breach_pct"),
    # ── Related party purchases ─────────────────────────────────────────
    ("related_party_buy_pct",       "related_party_purchases_pct"),
    ("rpt_purchase_pct",            "related_party_purchases_pct"),
    ("related_party_purchase_pct",  "related_party_purchases_pct"),
    # ── Wage breakdown (after _expand_nested flattens {"wages": {...}}) ──
    ("wages_total",            "total_wages"),
    ("wages_female",           "female_wages"),
    ("wages_male",             "male_wages"),
    ("wages_small_town",       "small_town_wages"),
    ("salary_total",           "total_wages"),
    ("salary_female",          "female_wages"),
    # ── Median wage (LLM often emits {"median_wage": {"Male":…, "Female":…}}) ──
    ("median_wage_male",       "median_wage_male_inr"),
    ("median_wage_female",     "median_wage_female_inr"),
    ("median_pay_male",        "median_wage_male_inr"),
    ("median_pay_female",      "median_wage_female_inr"),
    # ── Workforce — when LLM emits "Permanent Employees" instead of "Permanent (D)" ──
    ("permanent_employees",        "permanent_employees_total"),
    ("permanent_workers",          "permanent_workers_total"),
    ("other_employees",            "other_employees_total"),
    ("other_workers",              "other_workers_total"),
    ("contract_employees",         "contract_employees_total"),
    # ── Energy / Water / Waste — common LLM phrasings ───────────────────
    ("kwh",                        "kwh_consumed"),
    ("electricity_kwh",            "kwh_consumed"),
    ("units_consumed",             "kwh_consumed"),
    ("water_kl",                   "kiloliters_consumed"),
    ("water_consumed_kl",          "kiloliters_consumed"),
    ("waste_total_mt",             "total_waste_mt"),
    ("waste_generated_mt",         "total_waste_mt"),

    # ── Workforce nested patterns (after recursive _expand_nested) ──────
    # Ollama emits {"employees": {"permanent": {"total": …, "male": …}}}
    # The expander flattens to employees_permanent_total etc.; map to canonical.
    ("employees_permanent_total",   "permanent_employees_total"),
    ("employees_permanent_male",    "permanent_employees_male"),
    ("employees_permanent_female",  "permanent_employees_female"),
    ("employees_other_total",       "other_employees_total"),
    ("employees_contract_total",    "contract_employees_total"),
    ("employees_differently_abled", "differently_abled_employees"),
    ("workers_permanent_total",     "permanent_workers_total"),
    ("workers_permanent_male",      "permanent_workers_male"),
    ("workers_permanent_female",    "permanent_workers_female"),
    ("workers_other_total",         "other_workers_total"),
    ("workers_differently_abled",   "differently_abled_workers"),
    # Wrapped under "workforce" container
    ("workforce_employees_permanent_total",  "permanent_employees_total"),
    ("workforce_employees_permanent_male",   "permanent_employees_male"),
    ("workforce_employees_permanent_female", "permanent_employees_female"),
    ("workforce_workers_permanent_total",    "permanent_workers_total"),
    ("workforce_workers_permanent_male",     "permanent_workers_male"),
    ("workforce_workers_permanent_female",   "permanent_workers_female"),
    ("workforce_permanent_employees_total",  "permanent_employees_total"),
    ("workforce_permanent_workers_total",    "permanent_workers_total"),
    # Median wages (nested under "median_wage" or "compensation")
    ("median_wages_male",      "median_wage_male_inr"),
    ("median_wages_female",    "median_wage_female_inr"),
    ("compensation_median_male",   "median_wage_male_inr"),
    ("compensation_median_female", "median_wage_female_inr"),
    ("compensation_total",     "total_wages"),
    ("compensation_female",    "female_wages"),
    ("compensation_male",      "male_wages"),
    ("compensation_small_town", "small_town_wages"),
    # Safety nested under "safety" / "ohs"
    ("safety_ltifr_employees",      "ltifr_employees"),
    ("safety_ltifr_workers",        "ltifr_workers"),
    ("safety_fatalities_employees", "fatalities_employees"),
    ("safety_fatalities_workers",   "fatalities_workers"),
    ("ohs_ltifr_employees",         "ltifr_employees"),
    ("ohs_ltifr_workers",           "ltifr_workers"),
    # GHG nested under "emissions" / "ghg"
    ("emissions_scope1",        "scope1_tco2e"),
    ("emissions_scope2",        "scope2_tco2e"),
    ("emissions_scope3",        "scope3_tco2e"),
    ("emissions_scope_1",       "scope1_tco2e"),
    ("emissions_scope_2",       "scope2_tco2e"),
    ("emissions_scope_3",       "scope3_tco2e"),
    ("ghg_scope1",              "scope1_tco2e"),
    ("ghg_scope2",              "scope2_tco2e"),
    ("ghg_scope3",              "scope3_tco2e"),
    # Environment container wrapping energy/water
    ("environment_kwh",                 "kwh_consumed"),
    ("environment_electricity_kwh",     "kwh_consumed"),
    ("environment_water_kl",            "kiloliters_consumed"),
    ("environment_total_waste_mt",      "total_waste_mt"),
    ("energy_kwh_consumed",             "kwh_consumed"),
    ("energy_total_kwh",                "kwh_consumed"),
    # Revenue nested under "financials" / "financial"
    ("financials_revenue_inr_crore",    "revenue_inr_crore"),
    ("financial_revenue_inr_crore",     "revenue_inr_crore"),
    ("financials_revenue_cr",           "revenue_inr_crore"),
    ("financials_turnover_inr_crore",   "revenue_inr_crore"),
]

# Build a lookup dict for O(1) resolution
_ALIAS_MAP: dict[str, str] = {fuzzy: canonical for fuzzy, canonical in _KEY_ALIASES}

# ── Workforce nested aliases — LLMs often emit "Permanent (D)" / "Permanent (W)"
#    as outer keys for nested {Total, Male, Female} structures. The expander
#    below walks each value; the alias map below remaps the outer key to a
#    canonical *base* (no _total suffix), then expansion appends the sub-key
#    name to produce permanent_employees_total / _male / _female / etc.
_WORKFORCE_OUTER_ALIASES: dict[str, str] = {
    "permanent_d":         "permanent_employees",
    "permanent_w":         "permanent_workers",
    "other_d":             "other_employees",
    "other_w":             "other_workers",
    "permanent":           "permanent_employees",
    "other_than_permanent": "other_employees",
    "contract":            "contract_employees",
    "differently_abled":   "differently_abled_employees",
}


def _normalize_key_format(k) -> str:
    """
    Canonicalise an LLM-emitted key string to lowercase_snake_case.
      "Permanent (D)"        → "permanent_d"
      "Total Energy (kWh)"   → "total_energy_kwh"
      "scope_1 emissions"    → "scope_1_emissions"
    """
    s = str(k).strip()
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_").lower()
    return s


_EXPAND_MAX_DEPTH = 6


def _expand_nested(raw: dict) -> dict:
    """
    Recursively flatten arbitrarily-nested dicts into single-level keys with
    underscore-joined paths.  Each path segment is normalised via
    _normalize_key_format before joining, so casing/punctuation in LLM keys
    never breaks downstream alias resolution.

    Examples
    --------
    {"Permanent (D)": {"Total": 33000, "Male": 25000, "Female": 8000}}
        ↓ (Pass 1 normalises keys → "permanent_d" → workforce alias →
           "permanent_employees")
        ↓ (this expander)
    {
      "permanent_employees":         33000,   # bubbled
      "permanent_employees_total":   33000,
      "permanent_employees_male":    25000,
      "permanent_employees_female":  8000,
    }

    Deeply-nested example (Ollama loves this shape):
    {"employees": {"permanent": {"total": 33000, "male": 25000, "female": 8000}}}
        ↓
    {
      "employees":                   33000,   # bubbled top
      "employees_permanent":         33000,   # bubbled mid
      "employees_permanent_total":   33000,
      "employees_permanent_male":    25000,
      "employees_permanent_female":  8000,
    }

    The Pass 3 alias map then resolves composite names like
    `employees_permanent_total` to canonical `permanent_employees_total`.

    Workforce outer aliases (permanent_d → permanent_employees) are applied to
    TOP-LEVEL keys only.  Sub-keys keep their natural underscore-snake form so
    alias lookup of the composite chain works deterministically.

    Non-dict values pass through unchanged.  Existing flat keys (e.g.
    "scope1_tco2e": 1240) are untouched.
    """
    out: dict = {}

    def _walk(prefix: str, val, depth: int):
        if depth > _EXPAND_MAX_DEPTH:
            return
        if isinstance(val, dict) and val:
            # Bubble: expose the dict's first-numeric value at this prefix so
            # callers reading the bare prefix still get a sane number.
            if prefix and prefix not in out:
                bubbled = _safe_float(val)
                if bubbled != 0.0:
                    out[prefix] = bubbled
            for sub_k, sub_v in val.items():
                sub_norm = _normalize_key_format(sub_k)
                if not sub_norm:
                    continue
                composite = f"{prefix}_{sub_norm}" if prefix else sub_norm
                _walk(composite, sub_v, depth + 1)
        else:
            if prefix and prefix not in out:
                out[prefix] = val

    for k, v in raw.items():
        # Top-level only: re-route workforce-style outer keys to canonical bases.
        # ("permanent_d" → "permanent_employees", etc.)
        base = _WORKFORCE_OUTER_ALIASES.get(k, k)
        if isinstance(v, dict) and v:
            _walk(base, v, 0)
        else:
            if base not in out:
                out[base] = v

    return out


def _resolve_aliases(raw: dict) -> dict:
    """
    Apply key-format normalisation + alias map to every key.
    First-occurrence wins; canonical keys that already exist are not overwritten.
    """
    out: dict = {}
    for k, v in raw.items():
        k_norm    = _normalize_key_format(k)
        canonical = _ALIAS_MAP.get(k_norm, k_norm)
        if canonical not in out:
            out[canonical] = v
    return out


def _normalize_raw(raw: dict) -> dict:
    """
    Step 1 of every calculate_kpis() call.

    Pipeline:
      1. Resolve aliases on raw keys ("Permanent (D)" → "permanent_d" → … )
      2. Expand one level of nested dicts ({"wages": {...}} → wages_male / wages_female / …)
      3. Resolve aliases AGAIN on the expanded keys (wages_female → female_wages, etc.)
         — required because _expand_nested produces composite keys that the
         alias map can resolve to canonical KPI input names.
      4. Well-being fraction correction (0.012 → 1.2)

    Downstream helpers (_f, _i, _s) only ever see canonical, flat keys.
    """
    # Pass 1 — alias resolution on raw keys
    out = _resolve_aliases(raw)

    # Pass 2 — flatten nested dicts (workforce / wage breakdowns)
    out = _expand_nested(out)

    # Pass 3 — alias resolution on the expanded keys (wages_female → female_wages, …)
    out = _resolve_aliases(out)

    # Pass 4 — well-being fraction correction (LLM may return 0.012 instead of 1.2)
    wb = out.get("wellbeing_spend_pct_revenue")
    if wb is not None:
        wb_f = _safe_float(wb)
        if 0 < wb_f < 1:
            out["wellbeing_spend_pct_revenue"] = round(wb_f * 100, 4)

    return out


# ── Robust numeric conversion ──────────────────────────────────────────────────
#
# Strips every common ESG/finance unit + currency token. Anchored to word
# boundaries so it doesn't chew through legitimate digits embedded in numbers.
_NUMERIC_CLEAN_RE = re.compile(
    r'(?:'
    r'crores?|cr\b|lakhs?|lac\b|million|billion|bn\b|mn\b|'
    r'tco2e|t\s*co2e|tonnes?|metric\s*tons?|mt\b|kgs?\b|gms?\b|'
    r'kwh|mwh|gwh|gj|mj|kw\b|mw\b|gw\b|'
    r'kl\b|kilo\s*litres?|m\^?3|m³|cubic\s*meters?|cum\b|'
    r'litres?|liters?|ml\b|'
    r'days?\b|hrs?\b|hours?|years?|months?|fy\s*\d{2,4}|'
    r'percent(?:age)?|pct\b|inr|rs\.?|usd|eur|gbp|aud|cad|'
    r'₹|\$|€|£|¥|'
    r'%|,'
    r')',
    re.IGNORECASE,
)

# Sub-keys we look for first when a value is a nested dict
_DICT_TOTAL_KEYS = ("Total", "total", "TOTAL", "Value", "value", "Amount", "amount", "Count", "count")

# Max recursion depth — guards against pathological nesting / cycles
_SAFE_FLOAT_MAX_DEPTH = 4


def _safe_float(value, _depth: int = 0) -> float:
    """
    Coerce any LLM-produced value to float — RECURSIVE.

      • None / missing                              → 0.0
      • "DATA_NOT_FOUND"                            → 0.0  (Data Gap Protocol)
      • bool                                        → 0.0  (never accidentally counts True as 1)
      • int / float                                 → float as-is
      • dict {"Total": 33000, "Male": 25000, ...}   → 33000.0  (prefers Total/Value/Amount)
      • dict (no Total)                             → first non-zero numeric value found
      • list [...]                                  → first non-zero numeric element
      • "1,240" / "₹500 Cr" / "88%" / "765.81 Crores" → 1240.0 / 500.0 / 88.0 / 765.81
      • anything else                               → 0.0  (never raises)

    NOTE: The literal string "DATA_NOT_FOUND" is preserved verbatim in the
    raw_values dict that flows to MongoDB. This function ONLY runs on the
    calculator's internal coerced copy — the original dict is untouched.
    """
    if _depth > _SAFE_FLOAT_MAX_DEPTH:
        return 0.0
    if value is None or isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    # Nested dict — Ollama frequently returns these for workforce / wage data
    if isinstance(value, dict):
        # Priority 1: standard sub-keys
        for k in _DICT_TOTAL_KEYS:
            if k in value:
                f = _safe_float(value[k], _depth + 1)
                if f != 0.0:
                    return f
        # Priority 2: first sub-value that resolves to a non-zero numeric
        for sub_v in value.values():
            f = _safe_float(sub_v, _depth + 1)
            if f != 0.0:
                return f
        return 0.0

    # List / tuple — same logic
    if isinstance(value, (list, tuple)):
        for item in value:
            f = _safe_float(item, _depth + 1)
            if f != 0.0:
                return f
        return 0.0

    # String — strip every unit / currency token, then extract the first number
    s = str(value).strip()
    if not s or s == "DATA_NOT_FOUND":
        return 0.0
    cleaned = _NUMERIC_CLEAN_RE.sub("", s).strip()
    m = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    if not m:
        return 0.0
    try:
        return float(m.group())
    except ValueError:
        return 0.0


def _f(raw: dict, key: str) -> float:
    """Read canonical key as float — 0.0 when missing or null."""
    return _safe_float(raw.get(key))


def _i(raw: dict, key: str) -> int:
    """Read canonical key as int — 0 when missing or null."""
    return int(_safe_float(raw.get(key)))


def _s(raw: dict, key: str, default: str = "default") -> str:
    v = raw.get(key)
    if v is None or v == "DATA_NOT_FOUND" or v == "":
        return default
    return str(v)


# ── Direct-override helper ─────────────────────────────────────────────────────

def _direct_or_calc(raw: dict, direct_key: str, calc_fn, *args) -> float:
    """
    Return the LLM-extracted pre-computed value when present and non-zero;
    fall back to calc_fn(*args) using component fields.
    This is the core of the "direct override" pattern.
    """
    direct = _f(raw, direct_key)
    return direct if direct != 0.0 else calc_fn(*args)


# ── SEBI formula functions ─────────────────────────────────────────────────────

def get_grid_region(state: str) -> str:
    return STATE_TO_GRID.get(state.lower().strip(), "default")


def calc_scope1_emissions(diesel_liters: float = 0, petrol_liters: float = 0,
                          lpg_kg: float = 0, cng_kg: float = 0) -> float:
    """Scope 1 GHG = sum of fuel combustion × IPCC/MoEFCC emission factors (tCO2e)."""
    return round(
        diesel_liters * FUEL_FACTORS["diesel_liters"]
        + petrol_liters * FUEL_FACTORS["petrol_liters"]
        + lpg_kg  * FUEL_FACTORS["lpg_kg"]
        + cng_kg  * FUEL_FACTORS["cng_kg"],
        4,
    )


def calc_scope2_emissions(kwh: float, state: str) -> float:
    """Scope 2 GHG = kWh consumed × CEA grid emission factor (tCO2e/MWh)."""
    factor = GRID_EMISSION_FACTORS.get(get_grid_region(state), GRID_EMISSION_FACTORS["default"])
    return round((kwh / 1000) * factor, 4)


def calc_ghg_intensity_ppp(scope1: float, scope2: float, revenue_inr: float) -> float:
    """SEBI BRSR Core: GHG Intensity = (S1+S2) / Revenue (PPP-adjusted INR Crore)."""
    if revenue_inr == 0:
        return 0.0
    revenue_ppp_crore = (revenue_inr / PPP_FACTOR) / 1e7
    return round((scope1 + scope2) / revenue_ppp_crore, 6)


def calc_ghg_intensity_per_rupee(scope1: float, scope2: float, revenue_inr_crore: float) -> float:
    """SEBI BRSR Core: GHG Intensity = (S1+S2) tCO2e / Revenue (INR Crore)."""
    if revenue_inr_crore == 0:
        return 0.0
    return round((scope1 + scope2) / revenue_inr_crore, 6)


def calc_energy_intensity_per_rupee(total_energy_gj: float, revenue_inr_crore: float) -> float:
    """SEBI BRSR Core: Energy Intensity = Total Energy (GJ) / Revenue (INR Crore)."""
    if revenue_inr_crore == 0:
        return 0.0
    return round(total_energy_gj / revenue_inr_crore, 6)


def calc_renewable_energy_pct(renewable_kwh: float, total_kwh: float) -> float:
    """% Energy from Renewable Sources = renewable kWh / total kWh × 100."""
    if total_kwh == 0:
        return 0.0
    return round((renewable_kwh / total_kwh) * 100, 2)


def calc_water_intensity(total_kl: float, revenue_inr_crore: float) -> float:
    """Water Intensity = Total Water (KL) / Revenue (INR Crore)."""
    if revenue_inr_crore == 0:
        return 0.0
    return round(total_kl / revenue_inr_crore, 4)


def calc_water_recycled_pct(recycled_kl: float, total_kl: float) -> float:
    """% Water Recovered/Recycled = recycled KL / total KL × 100."""
    if total_kl == 0:
        return 0.0
    return round((recycled_kl / total_kl) * 100, 2)


def calc_waste_intensity(total_waste_mt: float, revenue_inr_crore: float) -> float:
    """Waste Intensity = Total Waste (MT) / Revenue (INR Crore)."""
    if revenue_inr_crore == 0:
        return 0.0
    return round(total_waste_mt / revenue_inr_crore, 4)


def calc_waste_recovered_pct(recovered_mt: float, total_mt: float) -> float:
    """% Waste Recovered = recovered MT / total MT × 100."""
    if total_mt == 0:
        return 0.0
    return round((recovered_mt / total_mt) * 100, 2)


def calc_wellbeing_spend_pct(wellbeing_spend_inr: float, total_revenue_inr: float) -> float:
    """SEBI BRSR: Employee Well-being Spend % = wellbeing spend / total revenue × 100."""
    if total_revenue_inr == 0:
        return 0.0
    return round((wellbeing_spend_inr / total_revenue_inr) * 100, 4)


def calc_female_wage_pct(female_wages: float, total_wages: float) -> float:
    """SEBI BRSR: Gender Pay Equity = female wages / total wages × 100."""
    if total_wages == 0:
        return 0.0
    return round((female_wages / total_wages) * 100, 2)


def calc_small_town_wage_pct(small_town_wages: float, total_wages: float) -> float:
    """SEBI BRSR: Inclusive Development = small town wages / total wages × 100."""
    if total_wages == 0:
        return 0.0
    return round((small_town_wages / total_wages) * 100, 2)


def calc_msme_procurement_pct(msme_spend: float, total_purchases: float) -> float:
    """SEBI BRSR: Supplier Fairness = MSME spend / total purchases × 100."""
    if total_purchases == 0:
        return 0.0
    return round((msme_spend / total_purchases) * 100, 2)


def calc_median_wage_ratio(female_median: float, male_median: float) -> float:
    """
    SEBI BRSR Principle 5: Gender Pay Parity = Female Median / Male Median.
    1.0 = perfect parity; < 1.0 = pay gap.
    """
    if male_median == 0:
        return 0.0
    return round(female_median / male_median, 3)


def calc_data_breach_pct(breach_incidents: float, total_cyber_events: float) -> float:
    """SEBI BRSR: Data Security = breach incidents / total cyber events × 100."""
    if total_cyber_events == 0:
        return 0.0
    return round((breach_incidents / total_cyber_events) * 100, 2)


def calc_accounts_payable_days(accounts_payable: float, cogs: float) -> float:
    """SEBI BRSR: DPO = Accounts Payable / (COGS / 365)."""
    if cogs == 0:
        return 0.0
    return round(accounts_payable / (cogs / 365), 1)


def calc_related_party_pct(related_party_amount: float, total_amount: float) -> float:
    """Concentration of Related Party Transactions %."""
    if total_amount == 0:
        return 0.0
    return round((related_party_amount / total_amount) * 100, 2)


# ── Main orchestrator ──────────────────────────────────────────────────────────

def calculate_kpis(brsr_category: str, raw: dict) -> dict:
    """
    Given a brsr_category and a dict of raw values extracted by the LLM,
    return a dict of calculated SEBI BRSR KPIs.

    The first thing this function does is normalise `raw` through
    _normalize_raw() so all downstream logic uses canonical key names
    and clean numeric values regardless of how the LLM phrased them.
    """
    raw = _normalize_raw(raw)   # ← Key Normalizer runs here, every time
    kpis: dict = {}

    # ── ENVIRONMENTAL ──────────────────────────────────────────────────────────

    if brsr_category == "electricity_bill":
        kwh = _f(raw, "kwh_consumed")
        kpis["scope2_tco2e"]    = calc_scope2_emissions(kwh, _s(raw, "state"))
        kpis["total_energy_kwh"] = kwh
        kpis["total_energy_gj"] = round(kwh * KWH_TO_GJ, 4)

    elif brsr_category == "fuel_consumption":
        # Direct override: if LLM already stated Scope 1 (e.g. "scope 1 is 1240"),
        # use it verbatim.  Fall back to computing from fuel breakdown.
        computed_scope1 = calc_scope1_emissions(
            diesel_liters=_f(raw, "diesel_liters"),
            petrol_liters=_f(raw, "petrol_liters"),
            lpg_kg=_f(raw, "lpg_kg"),
            cng_kg=_f(raw, "cng_kg"),
        )
        kpis["scope1_tco2e"] = _direct_or_calc(raw, "scope1_tco2e", lambda: computed_scope1)

    elif brsr_category == "water_usage":
        total_kl = _f(raw, "kiloliters_consumed")
        kpis["total_water_kl"]    = total_kl
        kpis["water_recycled_pct"] = calc_water_recycled_pct(_f(raw, "recycled_kl"), total_kl)

    elif brsr_category == "waste_records":
        total_mt = _f(raw, "total_waste_mt")
        kpis["total_waste_mt"]      = total_mt
        kpis["waste_recovered_pct"] = calc_waste_recovered_pct(_f(raw, "recovered_mt"), total_mt)

    elif brsr_category == "air_emissions_log":
        kpis["nox_mt"] = _f(raw, "nox_mt")
        kpis["sox_mt"] = _f(raw, "sox_mt")
        kpis["pm_mt"]  = _f(raw, "pm_mt")
        kpis["pop_mt"] = _f(raw, "pop_mt")
        kpis["voc_mt"] = _f(raw, "voc_mt")
        kpis["hap_mt"] = _f(raw, "hap_mt")

    elif brsr_category == "scope3_emissions_data":
        scope3         = _f(raw, "scope3_tco2e")
        business_travel = _f(raw, "business_travel_tco2e")
        supply_chain    = _f(raw, "supply_chain_tco2e")
        kpis["scope3_tco2e"] = scope3 if scope3 > 0 else round(business_travel + supply_chain, 4)

    # ── SOCIAL ─────────────────────────────────────────────────────────────────

    elif brsr_category == "hr_wages_data":
        total_wages = _f(raw, "total_wages")

        # female_wage_pct — direct override wins; else compute from components
        kpis["female_wage_pct"] = _direct_or_calc(
            raw, "female_wage_pct",
            calc_female_wage_pct, _f(raw, "female_wages"), total_wages,
        )
        # small_town_wage_pct — same pattern
        kpis["small_town_wage_pct"] = _direct_or_calc(
            raw, "small_town_wage_pct",
            calc_small_town_wage_pct, _f(raw, "small_town_wages"), total_wages,
        )
        # wellbeing_spend_pct_revenue — _normalize_raw() already fixed fraction
        kpis["wellbeing_spend_pct_revenue"] = _direct_or_calc(
            raw, "wellbeing_spend_pct_revenue",
            calc_wellbeing_spend_pct, _f(raw, "wellbeing_spend"), _f(raw, "total_revenue"),
        )

    elif brsr_category == "supplier_msme_cert":
        kpis["msme_procurement_pct"] = _direct_or_calc(
            raw, "msme_procurement_pct",
            calc_msme_procurement_pct, _f(raw, "msme_spend"), _f(raw, "total_purchases"),
        )

    elif brsr_category == "posh_records":
        kpis["posh_complaints_count"] = _i(raw, "posh_complaints_count")

    elif brsr_category == "safety_incidents_log":
        kpis["ltifr_employees"]                      = _f(raw, "ltifr_employees")
        kpis["ltifr_workers"]                        = _f(raw, "ltifr_workers")
        kpis["fatalities_employees"]                 = _i(raw, "fatalities_employees")
        kpis["fatalities_workers"]                   = _i(raw, "fatalities_workers")
        kpis["total_recordable_injuries_employees"]  = _i(raw, "total_recordable_injuries_employees")
        kpis["safety_training_pct"]                  = _f(raw, "safety_training_pct")

    elif brsr_category == "workforce_records":
        male_median   = _f(raw, "median_wage_male_inr")
        female_median = _f(raw, "median_wage_female_inr")
        kpis["permanent_employees_total"]   = _i(raw, "permanent_employees_total")
        kpis["permanent_employees_male"]    = _i(raw, "permanent_employees_male")
        kpis["permanent_employees_female"]  = _i(raw, "permanent_employees_female")
        kpis["other_employees_total"]       = _i(raw, "other_employees_total")
        kpis["contract_employees_total"]    = _i(raw, "contract_employees_total")
        kpis["differently_abled_employees"] = _i(raw, "differently_abled_employees")
        kpis["permanent_workers_total"]     = _i(raw, "permanent_workers_total")
        kpis["permanent_workers_male"]      = _i(raw, "permanent_workers_male")
        kpis["permanent_workers_female"]    = _i(raw, "permanent_workers_female")
        kpis["other_workers_total"]         = _i(raw, "other_workers_total")
        kpis["differently_abled_workers"]   = _i(raw, "differently_abled_workers")
        kpis["median_wage_male_inr"]        = male_median
        kpis["median_wage_female_inr"]      = female_median
        kpis["median_wage_ratio"]           = calc_median_wage_ratio(female_median, male_median)
        kpis["women_in_board_pct"]          = _f(raw, "women_in_board_pct")
        kpis["women_in_kmp_pct"]            = _f(raw, "women_in_kmp_pct")
        kpis["turnover_rate_male"]          = _f(raw, "turnover_rate_male")
        kpis["turnover_rate_female"]        = _f(raw, "turnover_rate_female")
        kpis["union_membership_pct"]        = _f(raw, "union_membership_pct")
        kpis["human_rights_training_pct"]   = _f(raw, "human_rights_training_pct")

    elif brsr_category == "employee_benefits":
        kpis["health_insurance_employees_pct"]  = _f(raw, "health_insurance_employees_pct")
        kpis["health_insurance_workers_pct"]    = _f(raw, "health_insurance_workers_pct")
        kpis["accident_insurance_employees_pct"]= _f(raw, "accident_insurance_employees_pct")
        kpis["accident_insurance_workers_pct"]  = _f(raw, "accident_insurance_workers_pct")
        kpis["maternity_benefits_pct"]          = _f(raw, "maternity_benefits_pct")
        kpis["paternity_benefits_pct"]          = _f(raw, "paternity_benefits_pct")
        kpis["daycare_facilities_pct"]          = _f(raw, "daycare_facilities_pct")
        kpis["pf_coverage_pct"]                 = _f(raw, "pf_coverage_pct")
        kpis["gratuity_coverage_pct"]           = _f(raw, "gratuity_coverage_pct")
        kpis["esi_coverage_pct"]                = _f(raw, "esi_coverage_pct")
        # Direct override — LLM may return the final ratio directly
        kpis["wellbeing_spend_pct_revenue"] = _direct_or_calc(
            raw, "wellbeing_spend_pct_revenue",
            lambda: 0.0,   # no computable fallback from benefit-coverage fields alone
        )

    elif brsr_category == "consumer_complaints":
        kpis["data_privacy_complaints"]       = _i(raw, "data_privacy_complaints")
        kpis["advertising_complaints"]        = _i(raw, "advertising_complaints")
        kpis["cyber_security_complaints"]     = _i(raw, "cyber_security_complaints")
        kpis["essential_services_complaints"] = _i(raw, "essential_services_complaints")
        kpis["restrictive_trade_complaints"]  = _i(raw, "restrictive_trade_complaints")
        kpis["unfair_trade_complaints"]       = _i(raw, "unfair_trade_complaints")
        kpis["product_recall_voluntary"]      = _i(raw, "product_recall_voluntary")
        kpis["product_recall_forced"]         = _i(raw, "product_recall_forced")

    # ── GOVERNANCE ─────────────────────────────────────────────────────────────

    elif brsr_category == "governance_report":
        kpis["related_party_purchase_pct"] = _direct_or_calc(
            raw, "related_party_purchases_pct",
            calc_related_party_pct,
            _f(raw, "related_party_purchases"), _f(raw, "total_purchases"),
        )
        kpis["related_party_sales_pct"] = calc_related_party_pct(
            _f(raw, "related_party_sales"), _f(raw, "total_sales")
        )
        kpis["regulatory_fines_count"]             = _i(raw, "regulatory_fines_count")
        kpis["regulatory_fines_inr"]               = _f(raw, "regulatory_fines_inr")
        kpis["anti_competitive_cases"]             = _i(raw, "anti_competitive_cases")
        kpis["conflict_of_interest_complaints"]    = _i(raw, "conflict_of_interest_complaints")
        # Direct override for breach — may come from governance_report doc
        kpis["data_breach_pct_incidents"] = _direct_or_calc(
            raw, "data_breach_pct",
            lambda: 0.0,
        )

    elif brsr_category == "accounts_payable":
        kpis["accounts_payable_days"] = _direct_or_calc(
            raw, "payable_days",
            calc_accounts_payable_days,
            _f(raw, "accounts_payable"), _f(raw, "cogs"),
        )

    elif brsr_category == "cyber_security_log":
        kpis["data_breach_pct_incidents"] = _direct_or_calc(
            raw, "data_breach_pct",
            calc_data_breach_pct,
            _f(raw, "breach_incidents"), _f(raw, "total_cyber_events"),
        )

    # ── FINANCIAL ─────────────────────────────────────────────────────────────

    elif brsr_category == "financial_statements":
        revenue            = _f(raw, "revenue_inr_crore")
        total_energy_gj    = _f(raw, "total_energy_gj")
        renewable_energy_gj = _f(raw, "renewable_energy_gj")

        kpis["revenue_inr_crore"]        = revenue
        kpis["total_energy_gj"]          = total_energy_gj
        kpis["renewable_energy_gj"]      = renewable_energy_gj
        kpis["energy_intensity_per_rupee"] = calc_energy_intensity_per_rupee(total_energy_gj, revenue)

        # GHG intensity — needs scope 1+2 from other categories; if passed through
        # financial_statements, use the direct values
        scope1 = _f(raw, "scope1_tco2e")
        scope2 = _f(raw, "scope2_tco2e")
        if revenue > 0 and (scope1 + scope2) > 0:
            kpis["ghg_intensity_per_rupee"] = calc_ghg_intensity_per_rupee(scope1, scope2, revenue)

        kpis["water_withdrawal_surface_kl"]      = _f(raw, "water_withdrawal_surface_kl")
        kpis["water_withdrawal_ground_kl"]       = _f(raw, "water_withdrawal_ground_kl")
        kpis["water_withdrawal_third_party_kl"]  = _f(raw, "water_withdrawal_third_party_kl")
        kpis["water_discharged_kl"]              = _f(raw, "water_discharged_kl")

        kpis["hazardous_waste_mt"]     = _f(raw, "hazardous_waste_mt")
        kpis["non_hazardous_waste_mt"] = _f(raw, "non_hazardous_waste_mt")
        kpis["plastic_waste_mt"]       = _f(raw, "plastic_waste_mt")
        kpis["ewaste_mt"]              = _f(raw, "ewaste_mt")
        kpis["waste_recycled_mt"]      = _f(raw, "waste_recycled_mt")
        kpis["waste_reused_mt"]        = _f(raw, "waste_reused_mt")
        kpis["waste_landfill_mt"]      = _f(raw, "waste_landfill_mt")
        kpis["bio_medical_waste_mt"]   = _f(raw, "bio_medical_waste_mt")
        kpis["construction_waste_mt"]  = _f(raw, "construction_waste_mt")
        kpis["battery_waste_mt"]       = _f(raw, "battery_waste_mt")
        kpis["radioactive_waste_mt"]   = _f(raw, "radioactive_waste_mt")
        kpis["waste_incinerated_mt"]   = _f(raw, "waste_incinerated_mt")

    return kpis
