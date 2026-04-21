"""Deterministic ticketing helpers for complaint operations."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def ticket_id_for_complaint(complaint_id: str) -> str:
    digest = hashlib.sha1(complaint_id.encode("utf-8")).hexdigest().upper()
    return f"OPR-{digest[:4]}-{digest[4:10]}"


def _build_history(detail: Dict[str, Any], owner_team: str) -> List[Dict[str, Any]]:
    history: List[Dict[str, Any]] = []
    submitted_at = detail.get("submitted_at")
    completed_at = detail.get("completed_at") or submitted_at
    complaint = detail.get("complaint") or {}
    classification = detail.get("classification") or {}
    compliance = detail.get("compliance_risk") or {}
    routing = detail.get("routing") or {}
    review_gate = detail.get("review_gate") or {}
    latest_review = detail.get("latest_review_decision") or {}
    resolution = detail.get("resolution") or {}

    history.append(
        {
            "code": "intake_received",
            "label": "Intake Received",
            "status": "completed",
            "timestamp": submitted_at,
            "detail": f"{complaint.get('channel', 'web').replace('_', ' ').title()} complaint captured and queued for analysis.",
        }
    )

    if classification:
        history.append(
            {
                "code": "classified",
                "label": "Classification Complete",
                "status": "completed",
                "timestamp": completed_at,
                "detail": f"Complaint classified as {classification.get('product', 'Unknown')} / {classification.get('issue', 'General handling')}.",
            }
        )

    if compliance:
        history.append(
            {
                "code": "compliance_assessed",
                "label": "Compliance Assessed",
                "status": "completed",
                "timestamp": completed_at,
                "detail": f"Regulatory risk scored at {compliance.get('risk_score', '—')} with level {compliance.get('risk_level', 'Unknown')}.",
            }
        )

    if routing:
        history.append(
            {
                "code": "routed",
                "label": "Routed To Team",
                "status": "completed",
                "timestamp": completed_at,
                "detail": f"Assigned to {owner_team} with {routing.get('priority', 'standard')} priority and {routing.get('sla_hours', '—')}h SLA.",
            }
        )

    if review_gate.get("needs_human_review"):
        history.append(
            {
                "code": "review_gate",
                "label": "Supervisor Review Gate",
                "status": "open" if not latest_review else "completed",
                "timestamp": completed_at,
                "detail": review_gate.get("because") or "Complaint requires supervisor review.",
            }
        )

    if latest_review:
        reviewer = latest_review.get("reviewer") or "Supervisor"
        history.append(
            {
                "code": "review_action",
                "label": "Supervisor Decision",
                "status": "completed",
                "timestamp": latest_review.get("created_at") or completed_at,
                "detail": f"{latest_review.get('action', 'Reviewed')} by {reviewer}. {latest_review.get('notes') or ''}".strip(),
            }
        )

    if resolution:
        history.append(
            {
                "code": "resolution_plan",
                "label": "Resolution Prepared",
                "status": "completed",
                "timestamp": completed_at,
                "detail": f"Resolution drafted with {len(resolution.get('action_plan') or [])} action steps.",
            }
        )

    history.sort(key=lambda entry: entry.get("timestamp") or "")
    return history


def build_ticket(
    detail: Dict[str, Any],
    *,
    customer_id: Optional[str],
    owner_team: str,
    queue: str,
    priority: Optional[str],
    sla_hours: Optional[int],
) -> Dict[str, Any]:
    submitted_at = detail.get("submitted_at")
    completed_at = detail.get("completed_at") or submitted_at
    review_gate = detail.get("review_gate") or {}
    latest_review = detail.get("latest_review_decision") or {}
    complaint_status = detail.get("status") or "received"

    status = "open"
    stage = "Intake"
    if latest_review.get("action", "").lower() in {"approved", "resolved", "closed", "complete"}:
        status = "closed"
        stage = "Closed"
    elif review_gate.get("needs_human_review"):
        status = "pending_supervisor"
        stage = "Supervisor Review"
    elif complaint_status == "analyzed":
        status = "in_progress"
        stage = "Team Investigation"
    elif complaint_status == "failed":
        status = "blocked"
        stage = "Exception Handling"

    due_at = None
    submitted_dt = _parse_iso(submitted_at)
    if submitted_dt and sla_hours:
        due_at = (submitted_dt + timedelta(hours=int(sla_hours))).isoformat()

    updated_at = latest_review.get("created_at") or completed_at or submitted_at
    history = _build_history(detail, owner_team)

    return {
        "ticket_id": ticket_id_for_complaint(detail["complaint_id"]),
        "complaint_id": detail["complaint_id"],
        "customer_id": customer_id,
        "status": status,
        "stage": stage,
        "owner_team": owner_team,
        "queue": queue,
        "priority": priority,
        "created_at": submitted_at,
        "updated_at": updated_at,
        "sla_hours": sla_hours,
        "due_at": due_at,
        "history": history,
    }
