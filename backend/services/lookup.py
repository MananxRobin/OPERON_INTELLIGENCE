"""Customer and ticket lookup helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from backend.services.company_logic import enrich_detail


def _sort_details(details: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(details, key=lambda detail: detail.get("submitted_at") or "", reverse=True)


def _ensure_enriched(detail: Dict[str, Any]) -> Dict[str, Any]:
    if detail.get("customer_profile") and detail.get("ticket"):
        return detail
    return enrich_detail(detail)


def _lookup_record(detail: Dict[str, Any]) -> Dict[str, Any]:
    enriched = _ensure_enriched(detail)
    complaint = enriched.get("complaint") or {}
    classification = enriched.get("classification") or {}
    compliance = enriched.get("compliance_risk") or {}
    customer = enriched.get("customer_profile") or {}
    ticket = enriched.get("ticket") or {}
    teams = enriched.get("internal_teams") or {}
    primary_team = teams.get("primary_team") or {}

    return {
        "customer_id": customer.get("customer_id"),
        "full_name": customer.get("full_name"),
        "state": customer.get("state") or complaint.get("customer_state"),
        "credit_score": customer.get("credit_score"),
        "default_probability": customer.get("default_probability"),
        "previous_complaints_count": customer.get("previous_complaints_count"),
        "complaint_id": enriched["complaint_id"],
        "ticket_id": ticket.get("ticket_id"),
        "ticket_status": ticket.get("status"),
        "product": classification.get("product") or complaint.get("product"),
        "issue": classification.get("issue"),
        "risk_level": compliance.get("risk_level"),
        "criticality_score": (enriched.get("criticality") or {}).get("score"),
        "assigned_team": primary_team.get("team_name") or (enriched.get("routing") or {}).get("assigned_team"),
        "queue": primary_team.get("queue"),
        "submitted_at": enriched.get("submitted_at"),
    }


def list_lookup_records(details: List[Dict[str, Any]], query: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    records = [_lookup_record(detail) for detail in _sort_details(details)]
    needle = (query or "").strip().lower()

    if needle:
        records = [
            record
            for record in records
            if any(
                needle in str(value).lower()
                for value in (
                    record.get("customer_id"),
                    record.get("full_name"),
                    record.get("complaint_id"),
                    record.get("ticket_id"),
                    record.get("product"),
                    record.get("issue"),
                    record.get("assigned_team"),
                    record.get("state"),
                )
                if value
            )
        ]

    return {
        "records": records[offset:offset + limit],
        "total": len(records),
    }


def get_customer_lookup(details: List[Dict[str, Any]], customer_id: str) -> Optional[Dict[str, Any]]:
    enriched = [_ensure_enriched(detail) for detail in _sort_details(details)]
    matches = [detail for detail in enriched if (detail.get("customer_profile") or {}).get("customer_id") == customer_id]
    if not matches:
        return None

    latest = matches[0]
    profile = dict(latest.get("customer_profile") or {})
    profile["previous_complaints_count"] = max(0, len(matches) - 1)

    complaints = []
    tickets = []
    timeline = []

    for detail in matches:
        classification = detail.get("classification") or {}
        compliance = detail.get("compliance_risk") or {}
        routing = detail.get("routing") or {}
        complaint = detail.get("complaint") or {}
        ticket = detail.get("ticket") or {}

        complaints.append(
            {
                "complaint_id": detail["complaint_id"],
                "ticket_id": ticket.get("ticket_id"),
                "product": classification.get("product") or complaint.get("product"),
                "issue": classification.get("issue"),
                "risk_level": compliance.get("risk_level"),
                "criticality_score": (detail.get("criticality") or {}).get("score"),
                "assigned_team": routing.get("assigned_team"),
                "status": detail.get("status"),
                "submitted_at": detail.get("submitted_at"),
            }
        )
        tickets.append(ticket)
        timeline.extend(ticket.get("history") or [])

    timeline.sort(key=lambda entry: entry.get("timestamp") or "", reverse=True)
    complaints.sort(key=lambda item: item.get("submitted_at") or "", reverse=True)
    tickets.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    open_products = profile.get("open_products") or []
    metrics = {
        "total_complaints": len(complaints),
        "open_tickets": sum(1 for ticket in tickets if ticket.get("status") not in {"closed", "resolved"}),
        "critical_cases": sum(1 for complaint in complaints if complaint.get("risk_level") == "CRITICAL"),
        "high_risk_cases": sum(1 for complaint in complaints if complaint.get("risk_level") in {"HIGH", "CRITICAL"}),
        "total_products": len(open_products),
        "total_loans": sum(1 for product in open_products if "loan" in str(product).lower() or "mortgage" in str(product).lower()),
    }

    return {
        "customer_id": customer_id,
        "profile": profile,
        "metrics": metrics,
        "complaints": complaints,
        "tickets": tickets,
        "timeline": timeline[:24],
        "latest_complaint_id": latest["complaint_id"],
    }
