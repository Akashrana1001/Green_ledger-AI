"""
PDF text extraction — static text layer + AcroForm field values.

Uses PyMuPDF (fitz) as the primary engine because it:
  • Reads values typed into fillable PDF fields (AcroForms / Widgets)
  • Preserves spatial structure better than pypdf for table-heavy BRSR reports
  • Handles multi-page documents with per-page field isolation

Falls back to pypdf if PyMuPDF is not installed.
"""
import io


# ── Checkbox value normalisation ──────────────────────────────────────────────
# Different PDF generators encode "checked" as "On", "/On", "Yes", "true", etc.
_CHECKBOX_CHECKED = {"on", "/on", "yes", "true", "1", "checked"}
_CHECKBOX_EMPTY   = {"off", "/off", "no", "false", "0", ""}


def _clean_field_value(raw_value: str, field_type_str: str) -> str | None:
    """
    Normalise a widget value for human/LLM consumption.

    Returns None  → skip this field (empty or unchecked checkbox)
    Returns "Yes" → checked checkbox
    Returns the raw string for all other filled text/list values.
    """
    if raw_value is None:
        return None
    s = str(raw_value).strip()

    if field_type_str == "CheckBox":
        if s.lower() in _CHECKBOX_CHECKED:
            return "Yes"
        return None                    # unchecked checkbox → skip

    return s if s else None            # empty text field → skip


def _page_text_fitz(page) -> str:
    """
    Extract the static text layer from a fitz Page.

    Tries Markdown mode first (PyMuPDF ≥ 1.24 renders tables as ASCII grids).
    Falls back to plain "text" mode — still much better than pypdf for BRSR
    tables because fitz uses the actual glyph positions.
    """
    try:
        md = page.get_text("markdown").strip()
        if md:
            return md
    except Exception:
        pass
    return page.get_text("text").strip()


def _extract_widgets_fitz(page) -> list[str]:
    """
    Return a list of human-readable "FIELD [name]: value" strings for every
    filled widget on the page.

    Field label preference order (fills the name slot):
      1. widget.field_label  — the human-visible text label (most descriptive)
      2. widget.field_name   — the programmatic PDF name  (e.g. "S1_GHG")
      3. "Unnamed Field"     — rare, but we still capture the value
    """
    lines: list[str] = []
    try:
        widgets = list(page.widgets())
    except Exception:
        return lines

    for w in widgets:
        raw_value = w.field_value
        field_type = getattr(w, "field_type_string", "Text")
        value = _clean_field_value(raw_value, field_type)
        if value is None:
            continue                   # empty / unchecked — skip

        label = (
            (getattr(w, "field_label", None) or "").strip()
            or (getattr(w, "field_name", None) or "").strip()
            or "Unnamed Field"
        )
        lines.append(f"  FIELD [{label}]: {value}")

    return lines


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract all readable text from a PDF, including AcroForm field values.

    Output format (per page):
    ┌─────────────────────────────────────────────────────────────────────┐
    │ === Page N ===                                                       │
    │ [static text layer — questions, labels, section headers, tables]    │
    │                                                                      │
    │ --- AcroForm Fields (Page N) ---                                     │
    │   FIELD [Total Energy Consumed (kWh)]: 125000                       │
    │   FIELD [Scope 1 GHG Emissions (tCO2e)]: 1240                       │
    │   ...                                                                │
    └─────────────────────────────────────────────────────────────────────┘

    The static text gives the LLM context (field labels, table headers,
    section names). The AcroForm block gives it the actual values typed in
    by the user. Combining both prevents the "all zeros" hallucination.

    Returns "" on any unrecoverable error.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        # Graceful fallback — static text only (no AcroForm values)
        return _extract_with_pypdf(file_bytes)

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception:
        return _extract_with_pypdf(file_bytes)

    pages_output: list[str] = []

    try:
        for page_num, page in enumerate(doc, 1):
            page_sections: list[str] = []

            # ── 1. Static text layer ───────────────────────────────────────
            base_text = _page_text_fitz(page)
            if base_text:
                page_sections.append(base_text)

            # ── 2. AcroForm / Widget values ────────────────────────────────
            field_lines = _extract_widgets_fitz(page)
            if field_lines:
                page_sections.append(
                    f"--- AcroForm Fields (Page {page_num}) ---\n"
                    + "\n".join(field_lines)
                )

            if page_sections:
                header = f"=== Page {page_num} ==="
                pages_output.append(header + "\n" + "\n\n".join(page_sections))
    finally:
        doc.close()

    return "\n\n".join(pages_output).strip()


# ── Fallback ──────────────────────────────────────────────────────────────────

def _extract_with_pypdf(file_bytes: bytes) -> str:
    """
    Legacy fallback using pypdf. Only reads the static text layer — does NOT
    extract AcroForm values. Used when PyMuPDF is not installed.
    """
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t)
        return "\n".join(pages_text).strip()
    except Exception:
        return ""
