"""LLM-based CV extraction — the semantic tier docs/04-cv-parser.md
originally called for, layered on top of (not replacing) the
deterministic parser in cv_parser.py.

This is a deliberate departure from the original "no external LLM API"
architecture decision (see docs/04, docs/08) — added at explicit product
direction with a real API key, not something to silently prefer over the
self-hosted-only design elsewhere. Disabled entirely when
settings.llm_api_key is unset; the rule-based parser in cv_parser.py is
always the fallback if this fails or is off, never bypassed. Every
top-level key from cv_parser.py's schema must still be present in the
output — email/phone are deliberately NOT asked of the model (regex
already handles those reliably and cheaply); the caller merges them in.
"""
import json
import re
import threading
from typing import Any

from openai import OpenAI

from app.core.config import settings

# Serializes calls to the third-party API so N simultaneous CV uploads
# queue up one-at-a-time instead of firing N concurrent requests at it —
# cheaper and less likely to hit a rate limit than a burst. Bump the
# count if the provider's rate limit comfortably allows more than one
# in flight; 1 is the conservative "just queue it" starting point.
_LLM_CONCURRENCY = 1
_llm_semaphore = threading.Semaphore(_LLM_CONCURRENCY)

SYSTEM_PROMPT = """You are a **CV-to-JSON extractor**.
Your task is to read a candidate's resume and produce a structured **JSON output** with **no extra commentary or text**.

---

### Rules:
1. Do **NOT** include any company or client names on the summariy.
2. Do **NOT** include dates or durations (except within `main_projects.duration`).
3. Do **NOT** include personal details such as name, gender, or photo.
4. Use professional English that is concise, factual, and neutral.
5. The output must be valid **JSON** with no trailing commas or syntax errors.

---

### JSON Output Structure:
```json
{
  "name": "Full name",
  "position": "Position",
  "summary": [
    "List of bullet points describing key strengths and professional background"
  ],
  "total_years_experience": "<total professional years of experience>",
  "technical_skills": {
    "programming_languages_and_frameworks": [
      {
        "name": "<technology or tool>",
        "years_of_experience": "<number of years>",
        "last_used": "<year last used>"
      }
    ],
    "databases": [
      {
        "name": "<database name>",
        "years_of_experience": "<number of years>",
        "last_used": "<year last used>"
      }
    ],
    "ai_tools": [
      {
        "name": "<tool name>",
        "years_of_experience": "<number of years>",
        "last_used": "<year last used>"
      }
    ],
    "others": [
      {
        "name": "<tool or skill name>",
        "years_of_experience": "<number of years>",
        "last_used": "<year last used>"
      }
    ]
  },
  "education": [
    {
      "institution": "<school or university name>",
      "major": "<major or field of study>",
      "year": "<year of enrollment> - <year of graduation>"
    }
  ],
  "certifications": [
    {
      "name": "<certification name>",
      "issuer": "<issuing organization>",
      "year_issued": "<year>"
    }
  ],
  "main_projects": [
    // Include EVERY project/role/engagement described anywhere in the
    // CV's work-history section, in the order they appear — do not
    // summarize, merge, or omit any of them, even if there are many or
    // some have little detail. One array entry per project, full stop.
    {
      "project_title": "<generic title without company name, e.g. 'Banking API QA Automation' or 'Healthcare Platform QA Management'>",
      "company_name": "<replace with generic term, e.g. 'fintech platform' or 'enterprise project'>",
      "location": "<country>, or '<country> (remote)'>",
      "language": "<language>",
      "position": "<position title>",
      "duration": "MM/YYYY - MM/YYYY",
      "duration_length": "<Y years M months>",
      "team_description": "<brief description of team structure or collaboration>",
      "project_description": "<overview of the project's goal or focus>",
      "responsibilities": [
        "List of responsibilities in bullet points"
      ],
      "technologies_used": [
        "List of tools, frameworks, or concepts"
      ]
    }
  ]
}
```

Formatting Rules:

- Output must be only a JSON code block (no extra text).
- Every list must be a valid JSON array.
- Each skill or technology must appear as its own object in "technical_skills".
- Never replace company names with generic descriptions (e.g., "fintech platform," "enterprise project").
- Infer project name if there's not any
- Copy responsibilities with what is written in the CV in verbatim, break it down to bullet points without headers
- Keep grammar clean, short, and accurate.
- `main_projects` must contain ALL projects/roles/engagements found anywhere in the CV, not a
  representative sample — if the CV lists 7 positions/projects, the output has 7 entries. Never
  truncate, summarize into fewer entries, or drop older/shorter ones for brevity.
- Output only valid JSON inside a Markdown code block."""

_EMPTY_SKILLS = {"programming_languages_and_frameworks": [], "databases": [], "ai_tools": [], "others": []}

_REQUIRED_KEYS = (
    "name",
    "position",
    "summary",
    "total_years_experience",
    "technical_skills",
    "education",
    "certifications",
    "main_projects",
)

_CODE_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)

_client: OpenAI | None = None


def is_enabled() -> bool:
    return bool(settings.llm_api_key)


def _get_client() -> OpenAI | None:
    global _client
    if not settings.llm_api_key:
        return None
    if _client is None:
        _client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
    return _client


def _extract_json(raw: str) -> dict[str, Any] | None:
    match = _CODE_FENCE_RE.search(raw)
    candidate = match.group(1) if match else raw.strip()
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize(data: dict[str, Any]) -> dict[str, Any]:
    """Guarantee every key cv_parser.py's schema promises is present, with
    the right empty-value shape, regardless of what the model actually
    returned — the frontend renders a stable set of sections either way."""
    skills = data.get("technical_skills")
    normalized_skills = dict(_EMPTY_SKILLS)
    if isinstance(skills, dict):
        for key in _EMPTY_SKILLS:
            value = skills.get(key)
            if isinstance(value, list):
                normalized_skills[key] = value

    return {
        "name": data.get("name") or None,
        "position": data.get("position") or None,
        "summary": data.get("summary") if isinstance(data.get("summary"), list) else [],
        "total_years_experience": data.get("total_years_experience") or None,
        "technical_skills": normalized_skills,
        "education": data.get("education") if isinstance(data.get("education"), list) else [],
        "certifications": data.get("certifications") if isinstance(data.get("certifications"), list) else [],
        "main_projects": data.get("main_projects") if isinstance(data.get("main_projects"), list) else [],
    }


def _confidence_for(parsed: dict[str, Any]) -> dict[str, float]:
    """Flat, one-score-per-field confidence — matches the granularity the
    rest of this codebase actually implements (see docs/04's correction),
    not the per-array-item target design. A successful LLM extraction is
    scored high per populated field; empty fields score 0."""

    def has_content(value: Any) -> bool:
        if isinstance(value, dict):
            return any(has_content(v) for v in value.values())
        if isinstance(value, list):
            return len(value) > 0
        return bool(value)

    return {key: (0.8 if has_content(parsed.get(key)) else 0.0) for key in _REQUIRED_KEYS}


def parse_cv_with_llm(text: str) -> tuple[dict[str, Any], dict[str, float]] | None:
    """Returns (parsed_fields, parse_confidence) for the fields this
    schema covers (NOT email/phone — callers merge those in from regex),
    or None on any failure. Never raises — every failure mode (network,
    invalid JSON, unexpected shape) falls through to None so the caller
    can fall back to the deterministic parser without a hard error."""
    client = _get_client()
    if client is None:
        return None
    try:
        with _llm_semaphore:
            response = client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                # Reasoning-capable models (e.g. glm-5) spend tokens on an
                # internal chain-of-thought (returned separately as
                # message.reasoning_content, not part of the JSON answer)
                # before ever emitting `content`. A budget sized for the
                # JSON alone (originally 4096) let it run out of tokens
                # mid-thought and finish_reason='length' with an EMPTY
                # content — silently "worked" but produced nothing. 16000
                # leaves enough room for both the reasoning (if any) and a
                # full main_projects-heavy resume's JSON.
                max_tokens=16000,
                temperature=0.2,
            )
        raw = response.choices[0].message.content
        if not raw:
            return None
        data = _extract_json(raw)
        if data is None:
            return None
        parsed = _normalize(data)
        return parsed, _confidence_for(parsed)
    except Exception:
        return None
