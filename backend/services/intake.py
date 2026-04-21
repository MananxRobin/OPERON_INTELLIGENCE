"""Canonical intake preview and normalization helpers."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Optional


CANONICAL_COLUMNS = [
    "intake_id",
    "received_at",
    "channel",
    "source_system",
    "consumer_name",
    "consumer_id",
    "account_id",
    "product",
    "issue",
    "customer_state",
    "narrative",
    "consent_status",
    "attachment_count",
    "priority_hint",
]


def _infer_channel(row: Dict[str, Any]) -> str:
    raw = str(row.get("channel") or row.get("source") or row.get("source_system") or row.get("submitted_via") or "").lower()
    if "phone" in raw or "call" in raw:
        return "phone"
    if "email" in raw:
        return "email"
    if "chat" in raw or "bot" in raw:
        return "ai_chat"
    if "form" in raw or "web" in raw or not raw:
        return "form"
    return raw


def parse_rows(text: Optional[str] = None, records: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    if records:
        return records
    if not text:
        return []

    stripped = text.strip()
    if not stripped:
        return []

    try:
        payload = json.loads(stripped)
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict):
            if isinstance(payload.get("records"), list):
                return [row for row in payload["records"] if isinstance(row, dict)]
            return [payload]
    except json.JSONDecodeError:
        pass

    if "," in stripped and "\n" in stripped:
        reader = csv.DictReader(io.StringIO(stripped))
        return [dict(row) for row in reader]

    return [{"narrative": stripped}]


def normalize_rows(text: Optional[str] = None, records: Optional[List[Dict[str, Any]]] = None, mode: str = "heuristic") -> Dict[str, Any]:
    rows = parse_rows(text=text, records=records)
    normalized_rows = []

    for index, raw in enumerate(rows):
        normalized = {
            "narrative": str(raw.get("narrative") or raw.get("message") or raw.get("body") or raw.get("complaint") or raw.get("description") or "").strip(),
            "product": str(raw.get("product") or raw.get("product_hint") or raw.get("category") or "").strip(),
            "channel": _infer_channel(raw),
            "customer_state": str(raw.get("customer_state") or raw.get("state") or raw.get("customer_region") or "").strip(),
            "date_received": str(raw.get("date_received") or raw.get("received_at") or datetime.utcnow().strftime("%Y-%m-%d"))[:10],
            "tags": raw.get("tags") if isinstance(raw.get("tags"), list) else [tag.strip() for tag in str(raw.get("tags") or "").split(",") if tag.strip()],
            "issue": str(raw.get("issue") or raw.get("topic") or raw.get("subtype") or "").strip(),
            "company": str(raw.get("company") or raw.get("institution") or raw.get("issuer") or "").strip(),
            "consumer_name": str(raw.get("consumer_name") or raw.get("name") or raw.get("customer_name") or "").strip(),
            "consumer_id": str(raw.get("consumer_id") or raw.get("customer_id") or "").strip(),
            "account_id": str(raw.get("account_id") or raw.get("account_number") or "").strip(),
            "consent_status": str(raw.get("consent_status") or raw.get("consent") or "captured").strip(),
            "attachment_count": int(raw.get("attachment_count") or 0),
            "priority_hint": str(raw.get("priority_hint") or raw.get("priority") or "").strip(),
            "source_system": str(raw.get("source_system") or raw.get("source") or _infer_channel(raw)).strip(),
        }

        matched_fields = sum(1 for value in normalized.values() if value not in ("", [], 0))
        confidence = min(0.98, 0.42 + matched_fields * 0.045 + (0.08 if mode == "llm_assisted" else 0.0))
        missing = [field for field in ("narrative", "product", "issue", "customer_state", "consumer_id") if not normalized.get(field)]
        recommendations = []
        if not normalized["consumer_id"]:
            recommendations.append("Map or generate a stable consumer_id before case creation.")
        if not normalized["product"]:
            recommendations.append("Provide a product hint to improve routing precision.")
        if not normalized["issue"]:
            recommendations.append("Add an issue summary or let classification infer it from the narrative.")
        if normalized["channel"] == "phone":
            recommendations.append("Attach transcript or QA summary for voice-channel explainability.")

        normalized_rows.append({
            "row_index": index,
            "normalized": normalized,
            "confidence": round(confidence, 2),
            "missing_fields": missing,
            "recommendations": recommendations,
            "used_llm": mode == "llm_assisted",
            "raw_row": raw,
        })

    return {
        "mode": mode,
        "rows": normalized_rows,
        "total_rows": len(normalized_rows),
        "high_confidence_rows": sum(1 for row in normalized_rows if row["confidence"] >= 0.85),
        "needs_review_rows": sum(1 for row in normalized_rows if row["confidence"] < 0.85 or row["missing_fields"]),
        "canonical_columns": CANONICAL_COLUMNS,
    }


def build_intake_preview(sample_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    channel_counts = {"phone": 0, "email": 0, "ai_chat": 0, "form": 0}
    rows = []
    for index, row in enumerate(sample_rows):
        channel = _infer_channel(row)
        if channel not in channel_counts:
            channel_counts[channel] = 0
        channel_counts[channel] += 1
        rows.append({
            "intake_id": row.get("intake_id") or f"INT-{index + 1:04d}",
            "received_at": row.get("received_at") or datetime.utcnow().isoformat(timespec="seconds"),
            "channel": channel,
            "source_system": row.get("source_system") or channel,
            "consumer_name": row.get("consumer_name") or "Unknown Consumer",
            "consumer_id": row.get("consumer_id") or f"CUST-{index + 1:06d}",
            "account_id": row.get("account_id") or f"ACC-{index + 1:06d}",
            "product": row.get("product") or "Unknown",
            "issue": row.get("issue") or "Unstructured intake",
            "customer_state": row.get("customer_state") or row.get("state") or "",
            "narrative": row.get("narrative") or row.get("message") or row.get("body") or "",
            "consent_status": row.get("consent_status") or "captured",
            "attachment_count": int(row.get("attachment_count") or 0),
            "priority_hint": row.get("priority_hint") or "",
        })

    sections = [
        {"channel": "phone", "label": "Phone", "description": "Contact-center transcripts, call summaries, QA notes", "count": channel_counts.get("phone", 0)},
        {"channel": "email", "label": "Email", "description": "Support inboxes, escalations, executive-response mailboxes", "count": channel_counts.get("email", 0)},
        {"channel": "ai_chat", "label": "AI Chat", "description": "Chatbot transcripts, escalation handoffs, sentiment snapshots", "count": channel_counts.get("ai_chat", 0)},
        {"channel": "form", "label": "Forms", "description": "Web forms, mobile submissions, authenticated case creation", "count": channel_counts.get("form", 0)},
    ]

    return {
        "canonical_columns": CANONICAL_COLUMNS,
        "sections": sections,
        "rows": rows,
    }
