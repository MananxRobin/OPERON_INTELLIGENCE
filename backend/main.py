"""FastAPI application for Operon Intelligence complaint operations."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlencode
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

try:
    from sse_starlette.sse import EventSourceResponse
except ImportError:
    class EventSourceResponse(StreamingResponse):
        def __init__(self, content, *args, **kwargs):
            async def wrapped():
                async for event in content:
                    yield f"event: {event.get('event', 'message')}\ndata: {event.get('data', '')}\n\n"

            super().__init__(wrapped(), media_type="text/event-stream", *args, **kwargs)

from backend.agents.orchestrator import Orchestrator
from backend.data.sample_complaints import SAMPLE_COMPLAINTS
from backend.database import (
    complaint_exists,
    complete_schedule_run,
    count_complaints,
    create_schedule,
    create_schedule_run,
    delete_schedule,
    fail_running_schedule_runs,
    get_all_complaints,
    get_audit_trail,
    get_complaint,
    get_due_schedules,
    get_schedule,
    get_schedule_by_name,
    init_db,
    list_schedule_runs,
    list_schedules,
    save_analysis_result,
    save_audit_log,
    save_complaint,
    update_schedule,
    update_complaint_status,
)
from backend.services.company_logic import (
    build_dashboard_stats_from_details,
    build_dashboard_trends_from_details,
    build_internal_team_metrics,
    build_summary_from_detail,
    build_supervisor_snapshot_from_summaries,
    enrich_detail,
)
from backend.services.intake import build_intake_preview, normalize_rows
from backend.services.lookup import get_customer_lookup, list_lookup_records
from backend.services.local_pipeline import (
    assess_compliance,
    build_audit_entries,
    build_qa,
    build_resolution,
    classify_complaint,
    route_complaint,
    run_local_pipeline,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=True)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
CFPB_SEARCH_URL = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"
DEFAULT_CFPB_SCHEDULE_NAME = "CFPB 4h Ingest"
SCHEDULER_POLL_SECONDS = 30

NORMALIZATION_BATCHES: Dict[int, Dict[str, Any]] = {}
REVIEW_DECISIONS: Dict[str, Dict[str, Any]] = {}
BATCH_COUNTER = count(1)
SCHEDULER_STOP: asyncio.Event | None = None
SCHEDULER_TASK: asyncio.Task | None = None
SCHEDULE_RUN_LOCK = asyncio.Lock()


def _has_llm_backend() -> bool:
    return bool(DEEPSEEK_API_KEY and DEEPSEEK_API_KEY != "your-api-key-here")


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _scheduler_enabled() -> bool:
    return not _env_flag("OPERON_DISABLE_SCHEDULER")


def _startup_ingest_enabled() -> bool:
    return _env_flag("OPERON_ENABLE_STARTUP_INGEST")


def _cors_origins() -> list[str]:
    configured = os.getenv("OPERON_CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ]


orchestrator = Orchestrator(api_key=DEEPSEEK_API_KEY, model=DEEPSEEK_MODEL)


def _persist_local_analysis(analysis: Dict[str, Any], metadata: Dict[str, Any], emit_events: bool = False) -> None:
    complaint = analysis["complaint"]
    complaint_id = analysis["complaint_id"]

    save_complaint(
        complaint_id=complaint_id,
        narrative=complaint["narrative"],
        product=complaint.get("product"),
        channel=complaint.get("channel", "web"),
        customer_state=complaint.get("customer_state"),
        customer_id=complaint.get("customer_id"),
        date_received=complaint.get("date_received"),
        tags=complaint.get("tags", []),
    )
    update_complaint_status(complaint_id, "processing")
    save_analysis_result(
        complaint_id=complaint_id,
        classification=analysis["classification"],
        compliance=analysis["compliance_risk"],
        routing=analysis["routing"],
        resolution=analysis["resolution"],
        qa=analysis["qa_validation"],
        total_time_ms=analysis["total_processing_time_ms"],
    )
    for entry in analysis.get("audit_trail", []):
        save_audit_log(
            complaint_id=complaint_id,
            agent_name=entry["agent_name"],
            decision=entry.get("decision", ""),
            confidence=entry.get("confidence"),
            reasoning=entry.get("reasoning", ""),
            evidence_spans=entry.get("evidence_spans", []),
            input_summary=entry.get("input_summary", ""),
            output_summary=entry.get("output_summary", ""),
            duration_ms=entry.get("duration_ms", 0),
        )
    update_complaint_status(complaint_id, "analyzed")

    if emit_events:
        orchestrator._active_jobs[complaint_id] = []
        for entry in analysis.get("audit_trail", []):
            orchestrator._emit_event(
                complaint_id,
                {
                    "agent": entry["agent_name"],
                    "status": "completed",
                    "message": entry.get("decision") or entry.get("output_summary") or "Completed",
                    "duration_ms": entry.get("duration_ms"),
                },
            )
        orchestrator._emit_event(
            complaint_id,
            {
                "agent": "Orchestrator",
                "status": "completed",
                "message": f"Local analysis complete in {analysis['total_processing_time_ms']}ms",
                "total_processing_time_ms": analysis["total_processing_time_ms"],
            },
        )


async def _run_fast_analysis(
    complaint_id: str,
    narrative: str,
    metadata: Dict[str, Any],
    *,
    emit_events: bool,
) -> Dict[str, Any]:
    start = time.time()

    save_complaint(
        complaint_id=complaint_id,
        narrative=narrative,
        product=metadata.get("product"),
        channel=metadata.get("channel", "web"),
        customer_state=metadata.get("customer_state"),
        customer_id=metadata.get("customer_id"),
        date_received=metadata.get("date_received"),
        tags=metadata.get("tags", []),
    )
    update_complaint_status(complaint_id, "processing")

    if emit_events:
        orchestrator._active_jobs[complaint_id] = []
        orchestrator._emit_event(
            complaint_id,
            {
                "agent": "ClassificationAgent",
                "status": "running",
                "message": "Classifying complaint with fast DeepSeek/local hybrid path...",
            },
        )

    classification_source = "local"
    classification_started = time.time()
    if _has_llm_backend():
        user_message = orchestrator.classification_agent.build_user_message(narrative=narrative, metadata=metadata)
        try:
            classification = await asyncio.wait_for(
                asyncio.to_thread(orchestrator.classification_agent._request_structured_output, user_message),
                timeout=10.0,
            )
            classification = orchestrator.classification_agent.normalize_result(classification)
            classification_source = "deepseek_chat"
        except Exception:
            classification = classify_complaint(narrative, metadata)
    else:
        classification = classify_complaint(narrative, metadata)

    classification_duration_ms = int((time.time() - classification_started) * 1000)
    compliance = assess_compliance(narrative, classification, metadata)
    routing = route_complaint(narrative, classification, compliance, metadata)
    resolution = build_resolution(narrative, classification, compliance, routing)
    qa = build_qa(classification, compliance, routing)
    audit_trail = build_audit_entries(complaint_id, narrative, classification, compliance, routing, resolution, qa)
    if audit_trail:
        audit_trail[0]["duration_ms"] = classification_duration_ms
        audit_trail[0]["output_summary"] = (
            f"{classification_source} classification → {classification['product']} / {classification['issue']} / {classification['severity']}."
        )

    analysis = {
        "complaint_id": complaint_id,
        "status": "analyzed",
        "submitted_at": _now_iso(),
        "completed_at": _now_iso(),
        "complaint": {
            "narrative": narrative,
            "product": metadata.get("product"),
            "channel": metadata.get("channel", "web"),
            "customer_state": metadata.get("customer_state"),
            "customer_id": metadata.get("customer_id"),
            "date_received": metadata.get("date_received"),
            "tags": metadata.get("tags", []),
        },
        "classification": classification,
        "compliance_risk": compliance,
        "routing": routing,
        "resolution": resolution,
        "qa_validation": qa,
        "audit_trail": audit_trail,
        "total_processing_time_ms": int((time.time() - start) * 1000),
    }
    _persist_local_analysis(analysis, metadata, emit_events=False)

    if emit_events:
        orchestrator._emit_event(
            complaint_id,
            {
                "agent": "ClassificationAgent",
                "status": "completed",
                "message": f"Classification complete via {classification_source.replace('_', ' ')}",
                "duration_ms": classification_duration_ms,
            },
        )
        for entry in audit_trail[1:]:
            orchestrator._emit_event(
                complaint_id,
                {
                    "agent": entry["agent_name"],
                    "status": "completed",
                    "message": entry.get("decision") or entry.get("output_summary") or "Completed",
                    "duration_ms": entry.get("duration_ms"),
                },
            )
        orchestrator._emit_event(
            complaint_id,
            {
                "agent": "Orchestrator",
                "status": "completed",
                "message": f"Fast analysis complete in {analysis['total_processing_time_ms']}ms",
                "total_processing_time_ms": analysis["total_processing_time_ms"],
            },
        )

    return analysis


def _build_metadata(payload: Any) -> Dict[str, Any]:
    return {
        "id": payload.complaint_id,
        "product": payload.product,
        "channel": payload.channel,
        "customer_state": payload.customer_state,
        "customer_id": payload.customer_id,
        "date_received": payload.date_received,
        "tags": payload.tags,
    }


def _new_complaint_id() -> str:
    return f"CMP-{uuid4().hex[:8].upper()}"


def _prepare_detail(complaint_id: str) -> Optional[Dict[str, Any]]:
    detail = get_complaint(complaint_id)
    if not detail:
        return None
    if complaint_id in REVIEW_DECISIONS:
        detail["latest_review_decision"] = REVIEW_DECISIONS[complaint_id]
    return enrich_detail(detail)


def _all_details(limit: int = 500) -> list[Dict[str, Any]]:
    details: list[Dict[str, Any]] = []
    rows = get_all_complaints(limit=limit, offset=0)
    for row in rows:
        detail = _prepare_detail(row["complaint_id"])
        if detail:
            details.append(detail)
    return details


def _row_to_detail(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "complaint_id": row["complaint_id"],
        "status": row.get("status"),
        "submitted_at": row.get("submitted_at"),
        "completed_at": row.get("completed_at"),
        "complaint": {
            "narrative": row.get("narrative", ""),
            "product": row.get("product"),
            "channel": row.get("channel", "web"),
            "customer_state": row.get("customer_state"),
            "customer_id": row.get("customer_id"),
            "date_received": row.get("date_received"),
            "tags": row.get("tags", []),
        },
        "classification": row.get("classification_result") or {},
        "compliance_risk": row.get("compliance_result") or {},
        "routing": row.get("routing_result") or {},
        "resolution": {},
        "qa_validation": row.get("qa_result") or {},
        "audit_trail": [],
        "total_processing_time_ms": row.get("total_processing_time_ms"),
    }


def _all_summary_details(limit: int = 500, offset: int = 0) -> list[Dict[str, Any]]:
    rows = get_all_complaints(limit=limit, offset=offset)
    return [_row_to_detail(row) for row in rows]


def _full_summary_details() -> list[Dict[str, Any]]:
    total = count_complaints()
    if total <= 0:
        return []
    return _all_summary_details(limit=total, offset=0)


def _matches_filters(
    summary: Dict[str, Any],
    product: Optional[str],
    risk_level: Optional[str],
    customer_state: Optional[str],
    channel: Optional[str],
    tag: Optional[str],
    vulnerable_only: bool,
    needs_review: Optional[bool],
    high_risk: Optional[bool],
    sla_risk: Optional[bool],
    source: Optional[str],
) -> bool:
    if product and summary.get("product") != product:
        return False
    if risk_level and summary.get("risk_level") != risk_level:
        return False
    if customer_state and summary.get("customer_state") != customer_state:
        return False
    if channel and summary.get("channel") != channel:
        return False
    if tag and tag.lower() not in [str(item).lower() for item in summary.get("tags", [])]:
        return False
    if vulnerable_only and not summary.get("vulnerable_tags"):
        return False
    if needs_review is not None and summary.get("needs_human_review") is not needs_review:
        return False
    if high_risk is not None and (summary.get("risk_level") in {"HIGH", "CRITICAL"}) is not high_risk:
        return False
    if sla_risk is not None and summary.get("sla_breach_risk") is not sla_risk:
        return False
    if source and summary.get("source") != source:
        return False
    return True


def _build_filter_options(summaries: list[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "products": sorted({item["product"] for item in summaries if item.get("product")}),
        "risk_levels": sorted({item["risk_level"] for item in summaries if item.get("risk_level")}),
        "states": sorted({item["customer_state"] for item in summaries if item.get("customer_state")}),
        "channels": sorted({item["channel"] for item in summaries if item.get("channel")}),
        "tags": sorted({tag for item in summaries for tag in item.get("tags", [])}),
        "sources": sorted({item["source"] for item in summaries if item.get("source")}),
    }


def _list_complaints_payload(
    limit: int,
    offset: int,
    product: Optional[str],
    risk_level: Optional[str],
    customer_state: Optional[str],
    channel: Optional[str],
    tag: Optional[str],
    vulnerable_only: bool,
    needs_review: Optional[bool],
    high_risk: Optional[bool],
    sla_risk: Optional[bool],
    source: Optional[str],
) -> Dict[str, Any]:
    details = _full_summary_details()
    summaries = [build_summary_from_detail(detail) for detail in details]
    filtered = [
        summary
        for summary in summaries
        if _matches_filters(
            summary,
            product,
            risk_level,
            customer_state,
            channel,
            tag,
            vulnerable_only,
            needs_review,
            high_risk,
            sla_risk,
            source,
        )
    ]
    return {
        "complaints": filtered[offset:offset + limit],
        "total": len(filtered),
        "available_filters": _build_filter_options(summaries),
    }


def _complaint_detail_payload(complaint_id: str) -> Optional[Dict[str, Any]]:
    return _prepare_detail(complaint_id)


def _complaint_baseline_payload(complaint_id: str) -> Optional[Dict[str, Any]]:
    detail = _prepare_detail(complaint_id)
    if not detail:
        return None
    return {
        "complaint_id": complaint_id,
        "baseline": detail.get("baseline"),
        "criticality": detail.get("criticality"),
        "review_gate": detail.get("review_gate"),
    }


def _audit_payload(complaint_id: str) -> Optional[Dict[str, Any]]:
    detail = _prepare_detail(complaint_id)
    if not detail:
        return None
    trail = detail.get("audit_trail") or get_audit_trail(complaint_id)
    if not trail:
        return None
    return {"complaint_id": complaint_id, "audit_trail": trail}


def _dashboard_stats_payload() -> Dict[str, Any]:
    return build_dashboard_stats_from_details(_full_summary_details())


def _dashboard_trends_payload(days: int) -> Dict[str, Any]:
    return build_dashboard_trends_from_details(_full_summary_details(), limit_days=days)


def _dashboard_supervisor_payload(limit: int) -> Dict[str, Any]:
    summaries = [build_summary_from_detail(detail) for detail in _full_summary_details()]
    return build_supervisor_snapshot_from_summaries(summaries, queue_limit=limit)


def _internal_teams_payload() -> Dict[str, Any]:
    details = _full_summary_details()
    enriched = [enrich_detail(detail) for detail in details]
    return {"teams": build_internal_team_metrics(enriched), "total": len(enriched)}


def _lookup_records_payload(q: str, limit: int, offset: int) -> Dict[str, Any]:
    details = _full_summary_details()
    return list_lookup_records(details, query=q, limit=limit, offset=offset)


def _lookup_customer_payload(customer_id: str) -> Optional[Dict[str, Any]]:
    candidate_details = _full_summary_details()
    return get_customer_lookup(candidate_details, customer_id)


def _supervisor_queue_payload(queue: str, limit: int, offset: int) -> Dict[str, Any]:
    summaries = [build_summary_from_detail(detail) for detail in _full_summary_details()]
    if queue == "Needs Review":
        filtered = [summary for summary in summaries if summary.get("needs_human_review")]
    elif queue == "High Regulatory Risk":
        filtered = [summary for summary in summaries if summary.get("risk_level") in {"HIGH", "CRITICAL"}]
    elif queue == "SLA Breach Risk":
        filtered = [summary for summary in summaries if summary.get("sla_breach_risk")]
    else:
        filtered = summaries
    return {"queue": queue, "complaints": filtered[offset:offset + limit], "total": len(filtered)}


def _sample_intake_rows() -> list[Dict[str, Any]]:
    rows: list[Dict[str, Any]] = []
    channel_map = {
        "phone": "phone",
        "email": "email",
        "web": "form",
        "cfpb": "form",
    }
    for index, sample in enumerate(SAMPLE_COMPLAINTS[:18]):
        mapped_channel = channel_map.get(sample.get("channel", "web"), "form")
        if index % 7 == 0:
            mapped_channel = "ai_chat"
        rows.append(
            {
                "intake_id": f"ING-{index + 1:04d}",
                "received_at": f"{sample.get('date_received', '2026-04-01')}T09:{index % 6}0:00",
                "channel": mapped_channel,
                "source_system": {
                    "phone": "contact_center",
                    "email": "executive_mailbox",
                    "ai_chat": "assistant_handoff",
                    "form": "case_portal",
                }[mapped_channel],
                "consumer_name": f"Consumer {index + 1}",
                "consumer_id": f"CUST-{100000 + index}",
                "account_id": f"ACC-{220000 + index}",
                "product": sample.get("product", "Unknown"),
                "issue": sample.get("product", "Complaint intake"),
                "customer_state": sample.get("customer_state", ""),
                "narrative": sample.get("narrative", ""),
                "consent_status": "captured",
                "attachment_count": 1 if index % 3 == 0 else 0,
                "priority_hint": "urgent" if "unauthorized" in sample.get("narrative", "").lower() else "",
            }
        )
    return rows


def _utc_now() -> datetime:
    return datetime.utcnow()


def _now_iso() -> str:
    return _utc_now().isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _next_run_time(cadence: str, from_time: Optional[datetime] = None) -> Optional[datetime]:
    base = from_time or _utc_now()
    normalized = (cadence or "").lower()
    mapping = {
        "live_1m": timedelta(minutes=1),
        "live_5m": timedelta(minutes=5),
        "live_15m": timedelta(minutes=15),
        "live_60m": timedelta(minutes=60),
        "every_4h": timedelta(hours=4),
        "cron_4h": timedelta(hours=4),
        "4h": timedelta(hours=4),
    }
    if normalized in {"manual", "once"}:
        return None
    return base + mapping.get(normalized, timedelta(hours=4))


def _next_run_iso(cadence: str, from_time: Optional[datetime] = None) -> Optional[str]:
    next_run = _next_run_time(cadence, from_time=from_time)
    return next_run.isoformat() if next_run else None


def _normalize_tags(raw_tags: Any) -> list[str]:
    if isinstance(raw_tags, list):
        return [str(tag).strip() for tag in raw_tags if str(tag).strip()]
    if isinstance(raw_tags, str):
        parts = [part.strip() for part in raw_tags.split(",")]
        return [part for part in parts if part]
    return []


def _cfpb_narrative(source: Dict[str, Any]) -> str:
    narrative = (source.get("complaint_what_happened") or "").strip()
    if narrative:
        return narrative

    product = source.get("product") or "financial product"
    issue = source.get("issue") or "service handling"
    company = source.get("company") or "the institution"
    state = source.get("state") or "the consumer's state"
    response = source.get("company_response") or "response pending"
    timely = source.get("timely") or "Unknown"
    disputed = source.get("consumer_disputed") or "Unknown"
    submitted_via = source.get("submitted_via") or "CFPB portal"

    return (
        f"Consumer submitted a CFPB complaint via {submitted_via} about {company} involving "
        f"{product.lower()} and issue '{issue}'. The consumer is located in {state}. "
        f"Company response status: {response}. Timely response: {timely}. "
        f"Consumer disputed response: {disputed}."
    )


def _schedule_with_runs(schedule: Dict[str, Any], run_limit: int = 8) -> Dict[str, Any]:
    enriched = dict(schedule)
    enriched["runs"] = list_schedule_runs(schedule["id"], limit=run_limit)
    return enriched


def _fallback_cfpb_payload(size: int) -> Dict[str, Any]:
    seed_rows = [sample for sample in SAMPLE_COMPLAINTS if sample.get("channel") == "cfpb"] or SAMPLE_COMPLAINTS
    batch_marker = _utc_now().strftime("%Y%m%d%H%M")
    hits: list[Dict[str, Any]] = []

    for index in range(max(1, min(size, len(seed_rows)))):
        sample = seed_rows[index % len(seed_rows)]
        hits.append(
            {
                "_id": f"fallback-{batch_marker}-{index + 1}",
                "_source": {
                    "complaint_id": f"{batch_marker}{index + 1:03d}",
                    "product": sample.get("product"),
                    "issue": sample.get("product") or "Complaint intake",
                    "company": "CFPB Demo Feed",
                    "state": sample.get("customer_state"),
                    "submitted_via": str(sample.get("channel", "web")).title(),
                    "company_response": "In progress",
                    "timely": "Yes",
                    "consumer_disputed": "No",
                    "date_received": f"{sample.get('date_received', '2026-04-01')}T00:00:00-05:00",
                    "tags": sample.get("tags", []),
                    "complaint_what_happened": sample.get("narrative", ""),
                },
            }
        )

    return {
        "hits": {
            "hits": hits,
            "total": {"value": len(hits)},
        },
        "meta": {"fallback": True},
    }


def _fetch_cfpb_rows(size: int = 25, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "size": max(1, min(int(size or 25), 100)),
        "sort": "created_date_desc",
        "format": "json",
    }
    for key, value in (filters or {}).items():
        if value is None or value == "":
            continue
        params[key] = value

    query = urlencode(params, doseq=True)
    response = subprocess.run(
        ["curl", "--max-time", "5", "-fsSL", f"{CFPB_SEARCH_URL}?{query}"],
        capture_output=True,
        text=True,
        timeout=8,
        check=True,
    )
    return json.loads(response.stdout)


def _ingest_cfpb_batch_sync(
    *,
    size: int = 25,
    filters: Optional[Dict[str, Any]] = None,
    schedule_id: Optional[int] = None,
    schedule_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    used_fallback = False
    try:
        payload = _fetch_cfpb_rows(size=size, filters=filters)
    except Exception:
        payload = _fallback_cfpb_payload(size=size)
        used_fallback = True
    hits = payload.get("hits", {}).get("hits", []) or []

    processed_count = 0
    skipped_count = 0
    inserted_ids: list[str] = []

    for hit in hits:
        source = hit.get("_source", {}) or {}
        raw_complaint_id = str(source.get("complaint_id") or hit.get("_id") or "").strip()
        if not raw_complaint_id:
            skipped_count += 1
            continue

        complaint_id = f"CFPB-{raw_complaint_id}"
        if complaint_exists(complaint_id):
            skipped_count += 1
            continue

        metadata = {
            "id": complaint_id,
            "product": source.get("product"),
            "channel": "cfpb",
            "customer_state": source.get("state"),
            "customer_id": None,
            "date_received": (source.get("date_received") or "")[:10] or None,
            "tags": _normalize_tags(source.get("tags")),
            "schedule_id": schedule_id,
            "schedule_run_id": schedule_run_id,
        }
        narrative = _cfpb_narrative(source)
        analysis = run_local_pipeline(complaint_id, narrative, metadata)
        _persist_local_analysis(analysis, metadata, emit_events=False)
        processed_count += 1
        inserted_ids.append(complaint_id)

    total_hits = payload.get("hits", {}).get("total", {})
    total_available = total_hits.get("value") if isinstance(total_hits, dict) else len(hits)

    return {
        "source": "live_cfpb",
        "used_fallback": used_fallback,
        "fetched_count": len(hits),
        "total_available": total_available,
        "processed_count": processed_count,
        "skipped_count": skipped_count,
        "inserted_ids": inserted_ids[:10],
    }


async def _run_schedule_job(schedule_id: int, triggered_by: str = "manual") -> Dict[str, Any]:
    async with SCHEDULE_RUN_LOCK:
        schedule = get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        if triggered_by == "scheduler" and schedule.get("status") != "active":
            return {"status": "skipped", "schedule_id": schedule_id}

        run_id = create_schedule_run(schedule_id, mode=schedule.get("mode", "live"), triggered_by=triggered_by)
        payload = schedule.get("payload") or {}
        size = int(payload.get("size") or 25)
        filters = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}

        try:
            result_summary = await asyncio.to_thread(
                _ingest_cfpb_batch_sync,
                size=size,
                filters=filters,
                schedule_id=schedule_id,
                schedule_run_id=run_id,
            )
            complete_schedule_run(
                run_id,
                status="completed",
                processed_count=result_summary["processed_count"],
                result_summary=result_summary,
            )
            updated_schedule = update_schedule(
                schedule_id,
                last_run_at=_now_iso(),
                last_run_count=result_summary["processed_count"],
                next_run_at=_next_run_iso(schedule.get("cadence", "every_4h")) if schedule.get("status") == "active" else None,
            )
            return {
                "status": "completed",
                "schedule_id": schedule_id,
                "schedule": _schedule_with_runs(updated_schedule) if updated_schedule else None,
                "summary": result_summary,
            }
        except Exception as exc:
            result_summary = {"error": str(exc), "source": "live_cfpb"}
            complete_schedule_run(
                run_id,
                status="failed",
                processed_count=0,
                result_summary=result_summary,
            )
            update_schedule(
                schedule_id,
                last_run_at=_now_iso(),
                last_run_count=0,
                next_run_at=_next_run_iso(schedule.get("cadence", "every_4h")) if schedule.get("status") == "active" else None,
            )
            raise HTTPException(status_code=502, detail=f"Schedule run failed: {exc}") from exc


def _ensure_default_schedule() -> Dict[str, Any]:
    existing = get_schedule_by_name(DEFAULT_CFPB_SCHEDULE_NAME)
    if existing:
        return existing
    return create_schedule(
        name=DEFAULT_CFPB_SCHEDULE_NAME,
        mode="live",
        cadence="every_4h",
        source_type="cfpb_live",
        payload={"size": 25, "filters": {}},
        status="active",
        next_run_at=_next_run_iso("every_4h"),
    )


async def _scheduler_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        due_schedules = get_due_schedules(_now_iso())
        for schedule in due_schedules:
            try:
                await _run_schedule_job(schedule["id"], triggered_by="scheduler")
            except Exception:
                continue

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=SCHEDULER_POLL_SECONDS)
        except asyncio.TimeoutError:
            continue


async def _run_schedule_job_safe(schedule_id: int, triggered_by: str) -> None:
    try:
        await _run_schedule_job(schedule_id, triggered_by=triggered_by)
    except Exception:
        return


def _seed_demo_dataset() -> None:
    existing = {row["complaint_id"] for row in get_all_complaints(limit=500, offset=0)}
    for sample in SAMPLE_COMPLAINTS:
        if sample["id"] in existing:
            continue
        metadata = {
            "id": sample["id"],
            "product": sample.get("product"),
            "channel": sample.get("channel", "web"),
            "customer_state": sample.get("customer_state"),
            "date_received": sample.get("date_received"),
            "tags": sample.get("tags", []),
        }
        analysis = run_local_pipeline(sample["id"], sample["narrative"], metadata)
        _persist_local_analysis(analysis, metadata, emit_events=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global SCHEDULER_STOP, SCHEDULER_TASK

    init_db()
    fail_running_schedule_runs()
    _seed_demo_dataset()
    default_schedule = _ensure_default_schedule()
    if _scheduler_enabled():
        SCHEDULER_STOP = asyncio.Event()
        SCHEDULER_TASK = asyncio.create_task(_scheduler_loop(SCHEDULER_STOP))
    else:
        SCHEDULER_STOP = None
        SCHEDULER_TASK = None
    if default_schedule and not default_schedule.get("last_run_at") and _startup_ingest_enabled():
        asyncio.create_task(_run_schedule_job_safe(default_schedule["id"], triggered_by="startup"))
    try:
        yield
    finally:
        if SCHEDULER_STOP:
            SCHEDULER_STOP.set()
        if SCHEDULER_TASK:
            try:
                await SCHEDULER_TASK
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Operon Intelligence — Complaint AI",
    description="Agentic complaint intelligence for financial institutions.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    narrative: str
    product: Optional[str] = None
    channel: str = "web"
    customer_state: Optional[str] = None
    customer_id: Optional[str] = None
    date_received: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    complaint_id: Optional[str] = None


class BatchRequest(BaseModel):
    complaint_ids: list[str] = Field(default_factory=list)
    count: int = 5


class NormalizeRequest(BaseModel):
    text: Optional[str] = None
    records: Optional[list[Dict[str, Any]]] = None
    mode: str = "heuristic"
    source_name: Optional[str] = None
    submit_for_analysis: bool = False


class ReviewDecisionRequest(BaseModel):
    action: str
    reviewer: Optional[str] = None
    notes: Optional[str] = None


class ScheduleCreateRequest(BaseModel):
    name: str
    mode: str = "live"
    cadence: str = "every_4h"
    source_type: str = "cfpb_live"
    payload: Dict[str, Any] = Field(default_factory=dict)
    status: str = "active"


class SchedulePauseRequest(BaseModel):
    paused: bool = True


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "operon-intelligence",
        "ai_enabled": _has_llm_backend(),
        "ai_provider": "deepseek",
        "ai_model": DEEPSEEK_MODEL,
        "analysis_mode": "deepseek_reasoner" if _has_llm_backend() and DEEPSEEK_MODEL == "deepseek-reasoner" else ("deepseek_chat" if _has_llm_backend() else "local_fallback"),
    }


@app.get("/api/complaints/samples")
async def get_samples():
    samples = []
    for sample in SAMPLE_COMPLAINTS:
        narrative = sample["narrative"]
        samples.append(
            {
                "id": sample["id"],
                "narrative": narrative,
                "narrative_preview": narrative[:150] + ("..." if len(narrative) > 150 else ""),
                "product": sample.get("product", ""),
                "channel": sample.get("channel", "web"),
                "customer_state": sample.get("customer_state", ""),
                "tags": sample.get("tags", []),
                "date_received": sample.get("date_received", ""),
            }
        )
    return {"samples": samples, "total": len(samples)}


@app.post("/api/complaints/analyze")
async def analyze_complaint(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    if not request.narrative.strip():
        raise HTTPException(status_code=400, detail="Complaint narrative is required")

    metadata = _build_metadata(request)
    complaint_id = request.complaint_id or _new_complaint_id()
    metadata["id"] = complaint_id

    background_tasks.add_task(
        _run_fast_analysis,
        complaint_id=complaint_id,
        narrative=request.narrative,
        metadata=metadata,
        emit_events=True,
    )

    return {
        "complaint_id": complaint_id,
        "status": "processing",
        "message": "Complaint submitted for analysis. Use SSE endpoint to stream progress.",
    }


@app.post("/api/complaints/analyze/sync")
async def analyze_complaint_sync(request: AnalyzeRequest):
    if not request.narrative.strip():
        raise HTTPException(status_code=400, detail="Complaint narrative is required")

    metadata = _build_metadata(request)
    complaint_id = request.complaint_id or _new_complaint_id()
    metadata["id"] = complaint_id

    await _run_fast_analysis(
        complaint_id=complaint_id,
        narrative=request.narrative,
        metadata=metadata,
        emit_events=False,
    )

    detail = _prepare_detail(complaint_id)
    if not detail:
        raise HTTPException(status_code=500, detail="Analysis did not persist correctly")
    return detail


@app.get("/api/complaints/analyze/{complaint_id}/stream")
async def stream_analysis(complaint_id: str):
    async def event_generator():
        last_index = 0
        waited = 0.0
        max_wait = 90.0

        while waited < max_wait:
            events = orchestrator.get_events(complaint_id)

            while last_index < len(events):
                event = events[last_index]
                yield {"event": "agent_update", "data": json.dumps(event)}
                last_index += 1
                if event.get("agent") == "Orchestrator" and event.get("status") in {"completed", "failed"}:
                    detail = _prepare_detail(complaint_id)
                    yield {"event": "analysis_complete", "data": json.dumps(detail if detail else {"error": "Result not found"})}
                    orchestrator.cleanup_job(complaint_id)
                    return

            detail = _prepare_detail(complaint_id)
            if detail and detail.get("status") in {"analyzed", "failed"}:
                yield {"event": "analysis_complete", "data": json.dumps(detail)}
                orchestrator.cleanup_job(complaint_id)
                return

            await asyncio.sleep(0.5)
            waited += 0.5

        yield {"event": "timeout", "data": json.dumps({"message": "Analysis timed out"})}

    return EventSourceResponse(event_generator())


@app.get("/api/complaints")
async def list_complaints(
    limit: int = 50,
    offset: int = 0,
    product: Optional[str] = None,
    risk_level: Optional[str] = None,
    customer_state: Optional[str] = None,
    channel: Optional[str] = None,
    tag: Optional[str] = None,
    vulnerable_only: bool = False,
    needs_review: Optional[bool] = None,
    high_risk: Optional[bool] = None,
    sla_risk: Optional[bool] = None,
    source: Optional[str] = None,
):
    return await asyncio.to_thread(
        _list_complaints_payload,
        limit,
        offset,
        product,
        risk_level,
        customer_state,
        channel,
        tag,
        vulnerable_only,
        needs_review,
        high_risk,
        sla_risk,
        source,
    )


@app.get("/api/complaints/{complaint_id}")
async def get_complaint_detail(complaint_id: str):
    detail = await asyncio.to_thread(_complaint_detail_payload, complaint_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return detail


@app.get("/api/complaints/{complaint_id}/baseline")
async def get_complaint_baseline(complaint_id: str):
    payload = await asyncio.to_thread(_complaint_baseline_payload, complaint_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return payload


@app.get("/api/audit/{complaint_id}")
async def get_audit(complaint_id: str):
    payload = await asyncio.to_thread(_audit_payload, complaint_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return payload


@app.get("/api/dashboard/stats")
async def dashboard_stats():
    return await asyncio.to_thread(_dashboard_stats_payload)


@app.get("/api/dashboard/trends")
async def dashboard_trends(days: int = 14):
    return await asyncio.to_thread(_dashboard_trends_payload, days)


@app.get("/api/dashboard/supervisor")
async def dashboard_supervisor(limit: int = 6):
    return await asyncio.to_thread(_dashboard_supervisor_payload, limit)


@app.get("/api/internal-teams")
async def internal_teams():
    return await asyncio.to_thread(_internal_teams_payload)


@app.get("/api/lookup")
async def lookup_records(q: str = "", limit: int = 120, offset: int = 0):
    return await asyncio.to_thread(_lookup_records_payload, q, limit, offset)


@app.get("/api/lookup/customers/{customer_id}")
async def lookup_customer(customer_id: str):
    payload = await asyncio.to_thread(_lookup_customer_payload, customer_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Customer not found")
    return payload


@app.get("/api/intake/preview")
async def intake_preview():
    return build_intake_preview(_sample_intake_rows())


@app.post("/api/normalize/preview")
async def normalize_preview(request: NormalizeRequest):
    return normalize_rows(text=request.text, records=request.records, mode=request.mode)


@app.post("/api/normalize/submit")
async def normalize_submit(request: NormalizeRequest):
    payload = normalize_rows(text=request.text, records=request.records, mode=request.mode)
    batch_id = next(BATCH_COUNTER)
    submitted_ids: list[str] = []

    if request.submit_for_analysis:
        for row in payload["rows"]:
            normalized = row["normalized"]
            narrative = normalized.get("narrative", "").strip()
            if not narrative:
                continue
            complaint_id = f"NORM-{batch_id:04d}-{row['row_index'] + 1:03d}"
            metadata = {
                "id": complaint_id,
                "product": normalized.get("product") or None,
                "channel": normalized.get("channel") or "form",
                "customer_state": normalized.get("customer_state") or None,
                "customer_id": normalized.get("consumer_id") or None,
                "date_received": normalized.get("date_received") or None,
                "tags": normalized.get("tags") or [],
            }
            analysis = run_local_pipeline(complaint_id, narrative, metadata)
            _persist_local_analysis(analysis, metadata, emit_events=False)
            submitted_ids.append(complaint_id)

    batch_record = {
        "id": batch_id,
        "mode": request.mode,
        "source_name": request.source_name or "Normalization intake",
        "created_at": json.dumps({"iso": True}) and __import__("datetime").datetime.utcnow().isoformat(),
        "summary": {
            "total_rows": payload["total_rows"],
            "high_confidence_rows": payload["high_confidence_rows"],
            "needs_review_rows": payload["needs_review_rows"],
            "submitted_count": len(submitted_ids),
        },
        "rows": payload["rows"],
    }
    NORMALIZATION_BATCHES[batch_id] = batch_record

    return {
        "batch_id": batch_id,
        "summary": batch_record["summary"],
        "rows": payload["rows"],
        "submitted_ids": submitted_ids,
    }


@app.get("/api/normalization/{batch_id}")
async def normalization_batch(batch_id: int):
    batch = NORMALIZATION_BATCHES.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Normalization batch not found")
    return {"batch": {k: v for k, v in batch.items() if k != "rows"}, "rows": batch["rows"]}


@app.get("/api/schedules")
async def get_schedules():
    schedules = [_schedule_with_runs(schedule) for schedule in list_schedules(limit=100)]
    return {"schedules": schedules, "total": len(schedules)}


@app.post("/api/schedules")
async def create_schedule_definition(request: ScheduleCreateRequest):
    schedule = create_schedule(
        name=request.name,
        mode=request.mode,
        cadence=request.cadence,
        source_type=request.source_type,
        payload=request.payload,
        status=request.status,
        next_run_at=_next_run_iso(request.cadence) if request.status == "active" else None,
    )
    return {"schedule": _schedule_with_runs(schedule)}


@app.post("/api/schedules/{schedule_id}/run")
async def run_schedule_definition(schedule_id: int):
    await _run_schedule_job(schedule_id, triggered_by="manual")
    return {"status": "completed", "schedule_id": schedule_id}


@app.post("/api/schedules/{schedule_id}/pause")
async def pause_schedule_definition(schedule_id: int, request: SchedulePauseRequest):
    schedule = get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    updated = update_schedule(
        schedule_id,
        status="paused" if request.paused else "active",
        next_run_at=None if request.paused else _next_run_iso(schedule.get("cadence", "every_4h")),
    )
    return {"schedule": _schedule_with_runs(updated)} if updated else {"schedule": None}


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule_definition(schedule_id: int):
    if not get_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": delete_schedule(schedule_id), "schedule_id": schedule_id}


@app.get("/api/schedules/{schedule_id}/runs")
async def schedule_run_history(schedule_id: int):
    if not get_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule_id": schedule_id, "runs": list_schedule_runs(schedule_id, limit=50)}


@app.get("/api/supervisor/queue")
async def supervisor_queue(queue: str = "All", limit: int = 100, offset: int = 0):
    return await asyncio.to_thread(_supervisor_queue_payload, queue, limit, offset)


@app.post("/api/supervisor/review/{complaint_id}")
async def submit_review(complaint_id: str, request: ReviewDecisionRequest):
    detail = _prepare_detail(complaint_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Complaint not found")

    REVIEW_DECISIONS[complaint_id] = {
        "complaint_id": complaint_id,
        "action": request.action,
        "reviewer": request.reviewer,
        "notes": request.notes,
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    return {"complaint_id": complaint_id, "review_decision": REVIEW_DECISIONS[complaint_id]}


@app.post("/api/complaints/batch")
async def batch_process(request: BatchRequest, background_tasks: BackgroundTasks):
    samples = [sample for sample in SAMPLE_COMPLAINTS if not request.complaint_ids or sample["id"] in request.complaint_ids]
    if not request.complaint_ids:
        samples = samples[:request.count]

    submitted = []
    for sample in samples:
        metadata = {
            "id": sample["id"],
            "product": sample.get("product"),
            "channel": sample.get("channel", "web"),
            "customer_state": sample.get("customer_state"),
            "date_received": sample.get("date_received"),
            "tags": sample.get("tags", []),
        }
        if _has_llm_backend():
            background_tasks.add_task(orchestrator.process_complaint, narrative=sample["narrative"], metadata=metadata)
        else:
            analysis = run_local_pipeline(sample["id"], sample["narrative"], metadata)
            _persist_local_analysis(analysis, metadata, emit_events=False)
        submitted.append(sample["id"])

    return {"submitted": submitted, "count": len(submitted), "message": f"Submitted {len(submitted)} complaints for processing"}


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    if not FRONTEND_DIST.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")

    requested = (FRONTEND_DIST / full_path).resolve() if full_path else FRONTEND_DIST / "index.html"
    try:
        requested.relative_to(FRONTEND_DIST.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Not found") from exc

    if requested.is_file():
        return FileResponse(requested)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
