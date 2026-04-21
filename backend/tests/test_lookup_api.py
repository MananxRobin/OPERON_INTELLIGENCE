from __future__ import annotations


def test_lookup_endpoints_return_customer_ticket_history(client):
    complaints_res = client.get("/api/complaints?limit=10")
    assert complaints_res.status_code == 200
    complaints_payload = complaints_res.json()
    assert complaints_payload["total"] > 0

    first_complaint = complaints_payload["complaints"][0]
    assert first_complaint["ticket_id"].startswith("OPR-")
    assert first_complaint["customer_id"].startswith("CUST-")

    detail_res = client.get(f"/api/complaints/{first_complaint['complaint_id']}")
    assert detail_res.status_code == 200
    detail_payload = detail_res.json()
    assert detail_payload["ticket"]["ticket_id"] == first_complaint["ticket_id"]
    assert detail_payload["customer_profile"]["customer_id"] == first_complaint["customer_id"]
    assert len(detail_payload["ticket"]["history"]) >= 3

    lookup_res = client.get("/api/lookup?limit=10")
    assert lookup_res.status_code == 200
    lookup_payload = lookup_res.json()
    assert lookup_payload["total"] > 0

    lookup_record = lookup_payload["records"][0]
    customer_res = client.get(f"/api/lookup/customers/{lookup_record['customer_id']}")
    assert customer_res.status_code == 200
    customer_payload = customer_res.json()
    assert customer_payload["profile"]["customer_id"] == lookup_record["customer_id"]
    assert customer_payload["metrics"]["total_complaints"] >= 1
    assert len(customer_payload["tickets"]) >= 1
    assert len(customer_payload["timeline"]) >= 1


def test_schedule_defaults_exist_for_cron_ingest(client):
    schedules_res = client.get("/api/schedules")
    assert schedules_res.status_code == 200
    payload = schedules_res.json()
    assert payload["total"] >= 1

    default_schedule = next(schedule for schedule in payload["schedules"] if schedule["name"] == "CFPB 4h Ingest")
    assert default_schedule["cadence"] == "every_4h"
    assert default_schedule["status"] == "active"
