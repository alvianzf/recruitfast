"""CV text extraction + structured field parsing.

Three tiers, tried in order by `parse_cv_text`:

0. **LLM extraction** (`app/services/llm_cv_parser.py`): when
   `settings.llm_api_key` is set, a hosted-model call does the semantic
   extraction docs/04 originally scoped for a local SLM — this is a
   deliberate departure from the "no external API, self-hosted only"
   architecture decision recorded there and in docs/08, added at explicit
   product direction with a real key, not something this module defaults
   to silently preferring in every deployment. Disabled entirely (falls
   through to tier 1) when no key is configured.
1. **Labeled-format parser** (`_try_labeled_format`): resume summary sheets
   that use explicit field labels (`NAME`, `POSITION`, `TECHNICAL SKILLS`,
   `MAIN PROJECTS`, ...) can be parsed field-by-field with high confidence
   — no NER/SLM needed, the labels ARE the structure. This is a real,
   accurate parse when the format matches, not a heuristic.
2. **Generic fallback** (regex email/phone + first-plausible-line name):
   used when the labeled format isn't detected and the LLM tier is
   disabled or fails. Low confidence by design.

Sections a given tier can't fill stay empty with
`parse_status = "needs_review"` — every parse routes to review regardless
of tier; nothing auto-promotes to `confirmed` yet.

`.doc` (legacy binary Word) is not supported — no pure-Python parser
exists for it (docs/04 specifies a LibreOffice-headless conversion step
which isn't wired up here); callers should reject `.doc` uploads with a
clear message rather than silently failing.
"""
import re
from pathlib import Path
from typing import Any

import pdfplumber
from docx import Document as DocxDocument

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?\d[\d\-\.\s\(\)]{7,}\d)")
YEAR_RANGE_RE = re.compile(r"^\d{4}\s*-\s*\d{4}$")

SUPPORTED_EXTENSIONS = {".pdf", ".docx"}
# Shared by every CV upload entry point, authenticated or public — see
# the security note in public_board.py's apply_to_job for why this must
# be enforced on the public path too, not just the authenticated one.
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

BULLET = "•"

SKILL_HEADER_MAP = {
    "PROGRAMMING LANGUAGES AND FRAMEWORKS": "programming_languages_and_frameworks",
    "DATABASES": "databases",
    "AI TOOLS": "ai_tools",
    "OTHER": "others",
}

PROJECT_FIELD_LABELS = [
    "PROJECT NAME & CLIENT ",
    "DURATION ",
    "LOCATION & LANGUAGE ",
    "POSITION ",
    "TEAM DESCRIPTION ",
    "PROJECT DESCRIPTION ",
    "RESPONSIBILITY ",
    "TECHNOLOGY STACK ",
    "MAINTENANCE",
]


class UnsupportedFileType(Exception):
    pass


def extract_text(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf_text(path)
    if ext == ".docx":
        return _extract_docx_text(path)
    if ext == ".doc":
        raise UnsupportedFileType(
            "Legacy .doc files aren't supported yet — please re-save as .docx or .pdf."
        )
    raise UnsupportedFileType(f"Unsupported file type: {ext}")


def _extract_pdf_text(path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
    return "\n".join(parts)


def _extract_docx_text(path: Path) -> str:
    doc = DocxDocument(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _guess_name(lines: list[str]) -> tuple[str | None, float]:
    for line in lines[:5]:
        stripped = line.strip()
        if not stripped or stripped.upper() in ("CURRICULUM VITAE", "RESUME", "CV"):
            continue
        if EMAIL_RE.search(stripped) or PHONE_RE.search(stripped):
            continue
        word_count = len(stripped.split())
        if 1 <= word_count <= 5 and not any(ch.isdigit() for ch in stripped):
            # Heuristic only (first plausible line, no NER) — deliberately
            # capped below the "confirmed" threshold so it always routes
            # to review. See module docstring.
            return stripped, 0.55
    return None, 0.0


def _find_phone(text: str) -> str | None:
    for match in PHONE_RE.finditer(text):
        candidate = match.group(0).strip()
        digits = re.sub(r"\D", "", candidate)
        if YEAR_RANGE_RE.match(candidate) or len(digits) < 8:
            continue
        return candidate
    return None


def _strip_label(line: str, label: str) -> str:
    return line[len(label):].strip()


def _is_boundary(line: str, extra_labels: list[str]) -> bool:
    if line in ("MAIN PROJECTS", "EDUCATION", "CERTIFICATIONS", "TECHNICAL SKILLS"):
        return True
    return any(line.startswith(lbl) for lbl in extra_labels)


def _collect_prose(lines: list[str], i: int, label: str, stop_labels: list[str]) -> tuple[str, int]:
    n = len(lines)
    first = _strip_label(lines[i], label).lstrip(BULLET).strip()
    parts = [first] if first else []
    i += 1
    while i < n and not _is_boundary(lines[i], stop_labels):
        if lines[i]:
            parts.append(lines[i].lstrip(BULLET).strip())
        i += 1
    return " ".join(p for p in parts if p), i


def _collect_bullets(lines: list[str], i: int, label: str, stop_labels: list[str]) -> tuple[list[str], int]:
    n = len(lines)
    items: list[str] = []
    first = _strip_label(lines[i], label)
    if first.startswith(BULLET):
        items.append(first[1:].strip())
    elif first:
        items.append(first)
    i += 1
    while i < n and not _is_boundary(lines[i], stop_labels):
        line = lines[i]
        if line.startswith(BULLET):
            items.append(line[1:].strip())
        elif line and items:
            items[-1] += " " + line.strip()
        i += 1
    return [it for it in items if it], i


def _parse_project_block(lines: list[str]) -> dict[str, Any] | None:
    """`lines` is everything between one 'MAIN PROJECTS' marker and the next."""
    proj: dict[str, Any] = {
        "project_title": None,
        "company_name": None,
        "location": None,
        "language": None,
        "position": None,
        "duration": None,
        "duration_length": None,
        "team_description": None,
        "project_description": None,
        "responsibilities": [],
        "technologies_used": [],
    }
    n = len(lines)
    i = 0
    while i < n:
        line = lines[i]
        if not line:
            i += 1
            continue
        if line.startswith("PROJECT NAME & CLIENT "):
            proj["project_title"] = _strip_label(line, "PROJECT NAME & CLIENT ")
            if i + 1 < n and not _is_boundary(lines[i + 1], PROJECT_FIELD_LABELS):
                proj["company_name"] = lines[i + 1].strip()
                i += 1
        elif line.startswith("DURATION "):
            proj["duration"] = _strip_label(line, "DURATION ")
        elif line.startswith("LOCATION & LANGUAGE "):
            proj["location"] = _strip_label(line, "LOCATION & LANGUAGE ")
            if i + 1 < n and not _is_boundary(lines[i + 1], PROJECT_FIELD_LABELS):
                proj["language"] = lines[i + 1].strip()
                i += 1
        elif line.startswith("POSITION "):
            proj["position"] = _strip_label(line, "POSITION ")
        elif line.startswith("TEAM DESCRIPTION "):
            text, i = _collect_prose(lines, i, "TEAM DESCRIPTION ", PROJECT_FIELD_LABELS)
            proj["team_description"] = text
            continue
        elif line.startswith("PROJECT DESCRIPTION "):
            text, i = _collect_prose(lines, i, "PROJECT DESCRIPTION ", PROJECT_FIELD_LABELS)
            proj["project_description"] = text
            continue
        elif line.startswith("RESPONSIBILITY "):
            items, i = _collect_bullets(lines, i, "RESPONSIBILITY ", PROJECT_FIELD_LABELS)
            proj["responsibilities"] = items
            continue
        elif line.startswith("TECHNOLOGY STACK "):
            items, i = _collect_bullets(lines, i, "TECHNOLOGY STACK ", PROJECT_FIELD_LABELS)
            proj["technologies_used"] = items
            continue
        # "MAINTENANCE" and anything else unrecognized is ignored.
        i += 1

    return proj if proj["project_title"] else None


def _try_labeled_format(text: str) -> dict[str, Any] | None:
    stripped = [l.strip() for l in text.splitlines()]
    if "BASIC INFO" not in stripped:
        return None

    n = len(stripped)
    name = position = None
    summary: list[str] = []
    skills: dict[str, list[dict[str, str]]] = {v: [] for v in SKILL_HEADER_MAP.values()}
    education: list[dict[str, Any]] = []
    main_projects: list[dict[str, Any]] = []

    i = 0
    while i < n:
        line = stripped[i]

        if line.startswith("NAME "):
            name = _strip_label(line, "NAME ")
        elif line.startswith("POSITION ") and not main_projects and position is None:
            position = _strip_label(line, "POSITION ")
        elif line == "PROFESSIONAL SUMMARY":
            i += 1
            while i < n and stripped[i] != "LANGUAGE":
                if stripped[i].startswith(BULLET):
                    summary.append(stripped[i][1:].strip())
                elif stripped[i] and summary:
                    summary[-1] += " " + stripped[i]
                i += 1
            continue
        elif line == "TECHNICAL SKILLS":
            i += 1
            if i < n and stripped[i].startswith("TECHNICAL SKILLS"):
                i += 1
            category = None
            while i < n and stripped[i] not in ("EDUCATION", "MAIN PROJECTS", "CERTIFICATIONS"):
                s = stripped[i]
                if s in SKILL_HEADER_MAP:
                    category = SKILL_HEADER_MAP[s]
                elif s.startswith("*"):
                    pass
                elif category and s:
                    m = re.match(r"^(.*\S)\s+(\d+)\s+(\d{4})$", s)
                    if m:
                        skills[category].append(
                            {"name": m.group(1), "years_of_experience": m.group(2), "last_used": m.group(3)}
                        )
                i += 1
            continue
        elif line == "EDUCATION":
            i += 1
            while i < n and stripped[i] not in ("MAIN PROJECTS", "CERTIFICATIONS"):
                m = re.match(r"^(\d{4}\s*-\s*(?:\d{4}|Present))\s+(.*\S)$", stripped[i])
                if m:
                    year, institution = m.group(1), m.group(2)
                    major = None
                    if i + 1 < n and stripped[i + 1].startswith("Major:"):
                        # Split off a trailing "Degree: ..." clause — schema
                        # only captures major, not degree (docs/04). The
                        # separator character before "Degree:" varies by
                        # document (bullet, en dash, em dash), so split on
                        # the "Degree:" text itself rather than assume one.
                        major_line = stripped[i + 1].replace("Major:", "", 1).strip()
                        major = re.split(r"Degree:", major_line)[0]
                        major = major.rstrip("•—–- ").strip()
                        i += 1
                    education.append({"institution": institution, "major": major, "year": year})
                i += 1
            continue
        elif line == "MAIN PROJECTS":
            # Collect this block's lines up to the next "MAIN PROJECTS" or EOF.
            i += 1
            block_start = i
            while i < n and stripped[i] != "MAIN PROJECTS":
                i += 1
            block = _parse_project_block(stripped[block_start:i])
            if block:
                main_projects.append(block)
            continue

        i += 1

    return {
        "name": name,
        "position": position,
        # Not extractable from this fixed legacy template — no "LOCATION"
        # label exists in its BASIC INFO block (only per-project location
        # inside MAIN PROJECTS, a different concept). Only the LLM tier
        # fills this in; see llm_cv_parser.py.
        "location": None,
        "summary": summary,
        "total_years_experience": None,
        "technical_skills": skills,
        "education": education,
        "certifications": [],
        "main_projects": main_projects,
    }


def parse_cv_text(text: str) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Returns (parsed_fields, parse_confidence, parse_status).

    Shape matches docs/04-cv-parser.md's parsed_fields schema. Tries the
    LLM semantic layer first (app/services/llm_cv_parser.py) when
    configured — a real departure from this module's original
    deterministic-only design, added at explicit product direction. Email/
    phone always come from the regex extraction below regardless of which
    tier ran, since the LLM prompt deliberately isn't asked for them.
    """
    email_match = EMAIL_RE.search(text)
    phone = _find_phone(text)

    from app.services.llm_cv_parser import parse_cv_with_llm  # local import: openai is optional infra, not a hard dependency of this module

    llm_result = parse_cv_with_llm(text)
    if llm_result is not None:
        llm_fields, llm_confidence = llm_result
        parsed_fields = {**llm_fields, "email": email_match.group(0) if email_match else None, "phone": phone}
        parse_confidence = {
            **llm_confidence,
            "email": 0.95 if email_match else 0.0,
            "phone": 0.85 if phone else 0.0,
        }
        return parsed_fields, parse_confidence, "needs_review"

    labeled = _try_labeled_format(text)

    if labeled is not None:
        parsed_fields = {**labeled, "email": email_match.group(0) if email_match else None, "phone": phone}
        parse_confidence: dict[str, Any] = {
            "name": 0.9 if labeled["name"] else 0.0,
            "email": 0.95 if email_match else 0.0,
            "phone": 0.85 if phone else 0.0,
            "position": 0.85 if labeled["position"] else 0.0,
            "location": 0.0,
            "summary": 0.8 if labeled["summary"] else 0.0,
            "total_years_experience": 0.0,
            "technical_skills": 0.85 if any(labeled["technical_skills"].values()) else 0.0,
            "education": 0.85 if labeled["education"] else 0.0,
            "certifications": 0.0,
            "main_projects": 0.85 if labeled["main_projects"] else 0.0,
        }
    else:
        lines = text.splitlines()
        name, name_confidence = _guess_name(lines)
        parsed_fields = {
            "name": name,
            "email": email_match.group(0) if email_match else None,
            "phone": phone,
            "position": None,
            "location": None,
            "summary": [],
            "total_years_experience": None,
            "technical_skills": {
                "programming_languages_and_frameworks": [],
                "databases": [],
                "ai_tools": [],
                "others": [],
            },
            "education": [],
            "certifications": [],
            "main_projects": [],
        }
        parse_confidence = {
            "name": name_confidence,
            "email": 0.95 if email_match else 0.0,
            "phone": 0.75 if phone else 0.0,
            "position": 0.0,
            "location": 0.0,
            "summary": 0.0,
            "total_years_experience": 0.0,
            "technical_skills": 0.0,
            "education": 0.0,
            "certifications": 0.0,
            "main_projects": 0.0,
        }

    # Every parse routes to review in this implementation — either because
    # confidence is genuinely low (generic fallback) or because even the
    # labeled-format parse never fills every field (e.g. certifications,
    # total_years_experience) without the SLM layer. See module docstring.
    parse_status = "needs_review"

    return parsed_fields, parse_confidence, parse_status
