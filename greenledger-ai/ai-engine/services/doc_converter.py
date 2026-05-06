import base64
import io
from pathlib import Path

from PIL import Image

# File extensions handled as plain text (no image conversion, no OCR).
TEXT_EXTENSIONS  = {".txt", ".md", ".csv", ".log", ".tsv"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

# DPI used when rendering PDF pages to images for Bedrock multimodal extraction.
_PDF_RENDER_DPI = 150


def _bytes_to_base64_png(img_bytes: bytes) -> str:
    """Convert raw image bytes to base64-encoded PNG string."""
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def is_text_file(original_filename: str) -> bool:
    """True for plain-text formats that should bypass image/OCR conversion."""
    return Path(original_filename).suffix.lower() in TEXT_EXTENSIONS


def extract_text_content(file_bytes: bytes, original_filename: str) -> str:
    """
    Decode a text-format file (.txt/.md/.csv/.log/.tsv) to a string.
    Tries UTF-8 first, falls back to latin-1 with BOM stripping. Returns ""
    if the file is empty or the extension is not a recognised text format.
    """
    if not is_text_file(original_filename):
        return ""
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore").strip()


def convert_to_base64(file_bytes: bytes, original_filename: str) -> list[str]:
    """
    Convert a document to a list of base64 PNG strings (one per page for PDFs).
    Uses PyMuPDF (fitz) — no Poppler or system dependencies required.

    Plain-text files (.txt/.md/.csv/.log/.tsv) return [] — the caller must use
    `extract_text_content()` and route those through the text-only model path.
    """
    ext = Path(original_filename).suffix.lower()

    if ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            zoom = _PDF_RENDER_DPI / 72  # 72 is fitz default DPI
            matrix = fitz.Matrix(zoom, zoom)
            result = []
            for page in doc:
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                result.append(base64.b64encode(pix.tobytes("png")).decode("utf-8"))
            doc.close()
            return result
        except Exception as e:
            raise RuntimeError(f"PDF conversion failed: {e}") from e

    if ext in IMAGE_EXTENSIONS:
        return [_bytes_to_base64_png(file_bytes)]

    # Plain-text / Excel / Word — not image-based; caller handles via text path.
    return []
