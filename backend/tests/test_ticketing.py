from __future__ import annotations

from backend.services.ticketing import build_ticket, ticket_id_for_complaint


def test_ticket_id_is_deterministic():
    assert ticket_id_for_complaint("CMP-ABC123") == ticket_id_for_complaint("CMP-ABC123")
    assert ticket_id_for_complaint("CMP-ABC123").startswith("OPR-")


def test_build_ticket_shapes_status_and_timeline():
    detail = {
        "complaint_id": "CMP-TEST001",
        "status": "analyzed",
        "submitted_at": "2026-04-21T10:00:00",
        "completed_at": "2026-04-21T10:05:00",
        "complaint": {"channel": "email"},
        "classification": {"product": "Credit card", "issue": "Billing dispute"},
        "compliance_risk": {"risk_score": 81, "risk_level": "CRITICAL"},
        "routing": {"priority": "P1_IMMEDIATE", "sla_hours": 4},
        "resolution": {"action_plan": ["Open investigation", "Contact customer"]},
        "review_gate": {"needs_human_review": True, "because": "Human review required because critical regulatory risk."},
        "latest_review_decision": {"action": "Escalated", "reviewer": "Ops Lead", "created_at": "2026-04-21T10:10:00"},
    }

    ticket = build_ticket(
      detail,
      customer_id="CUST-123456",
      owner_team="Card Operations Team",
      queue="Card Servicing",
      priority="P1_IMMEDIATE",
      sla_hours=4,
    )

    assert ticket["ticket_id"].startswith("OPR-")
    assert ticket["status"] == "pending_supervisor"
    assert ticket["owner_team"] == "Card Operations Team"
    assert ticket["due_at"] == "2026-04-21T14:00:00"
    assert len(ticket["history"]) >= 5
