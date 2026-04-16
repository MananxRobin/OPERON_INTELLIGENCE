"""
FastAPI application — REST API + SSE endpoints for the complaint categorization system.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import Optional

from backend.database import (
    init_db, get_complaint, get_all_complaints,
    get_audit_trail, get_dashboard_stats, get_dashboard_trends
)
from backend.agents.orchestrator import Orchestrator
from backend.data.sample_complaints import SAMPLE_COMPLAINTS

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="Complaint Categorization AI",
    description="Agentic AI system for financial complaint classification, risk assessment, and resolution",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize orchestrator
orchestrator = Orchestrator(api_key=OPENAI_API_KEY)


# ──────────────────────────────────────────────
# Request Models
# ──────────────────────────────────────────────

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


PRIORITY_SLA_HOURS = {
    "P1_IMMEDIATE": 4,
    "P2_HIGH": 24,
    "P3_MEDIUM": 48,
    "P4_LOW": 72,
}

VULNERABLE_TAG_MARKERS = ("older", "elder", "servicemember", "military", "veteran")


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """Parse stored ISO timestamps into naive UTC datetimes."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _has_vulnerable_tag(tags: list[str]) -> bool:
    """Identify protected or vulnerable-customer tags used for triage."""
    lowered = [tag.lower() for tag in tags]
    return any(marker in tag for tag in lowered for marker in VULNERABLE_TAG_MARKERS)


def _build_complaint_summary(complaint: dict) -> dict:
    """Normalize complaint detail into a UI-friendly summary shape."""
    classification = complaint.get("classification_result", {}) or {}
    compliance = complaint.get("compliance_result", {}) or {}
    routing = complaint.get("routing_result", {}) or {}
    qa = complaint.get("qa_result", {}) or {}
    tags = complaint.get("tags", []) or []
    submitted_at = _parse_dt(complaint.get("submitted_at"))
    completed_at = _parse_dt(complaint.get("completed_at"))
    now = datetime.utcnow()
    priority = routing.get("priority")
    sla_hours = routing.get("sla_hours") or PRIORITY_SLA_HOURS.get(priority)
    age_hours = round((now - submitted_at).total_seconds() / 3600, 1) if submitted_at else None
    elapsed_for_sla = ((completed_at or now) - submitted_at).total_seconds() / 3600 if submitted_at else 0
    vulnerable_customer = _has_vulnerable_tag(tags)
    qa_passed = qa.get("passed")
    qa_score = qa.get("overall_score")
    requires_escalation = bool(compliance.get("requires_escalation"))
    requires_immediate_attention = bool(routing.get("requires_immediate_attention"))
    high_regulatory_risk = (
        compliance.get("risk_level") in ("HIGH", "CRITICAL")
        or (compliance.get("risk_score") or 0) >= 51
    )
    needs_human_review = (
        complaint.get("status") == "failed"
        or qa_passed is False
        or requires_escalation
        or requires_immediate_attention
    )
    sla_breach_risk = bool(
        sla_hours
        and (
            (complaint.get("status") != "analyzed" and elapsed_for_sla >= max(sla_hours * 0.65, 2))
            or (complaint.get("status") == "analyzed" and elapsed_for_sla > sla_hours)
        )
    )

    return {
        "complaint_id": complaint["complaint_id"],
        "status": complaint["status"],
        "product": classification.get("product"),
        "issue": classification.get("issue"),
        "severity": classification.get("severity"),
        "urgency": classification.get("urgency"),
        "risk_level": compliance.get("risk_level"),
        "risk_score": compliance.get("risk_score"),
        "applicable_regulations": compliance.get("applicable_regulations", []),
        "compliance_flag_count": len(compliance.get("flags", []) or []),
        "requires_escalation": requires_escalation,
        "assigned_team": routing.get("assigned_team"),
        "assigned_tier": routing.get("assigned_tier"),
        "priority": priority,
        "sla_hours": sla_hours,
        "requires_immediate_attention": requires_immediate_attention,
        "qa_passed": qa_passed,
        "qa_score": qa_score,
        "needs_human_review": needs_human_review,
        "high_regulatory_risk": high_regulatory_risk,
        "sla_breach_risk": sla_breach_risk,
        "submitted_at": complaint["submitted_at"],
        "completed_at": complaint.get("completed_at"),
        "narrative_preview": (
            complaint["narrative"][:150] + "..."
            if len(complaint["narrative"]) > 150 else complaint["narrative"]
        ),
        "channel": complaint.get("channel", "web"),
        "customer_state": complaint.get("customer_state"),
        "tags": tags,
        "vulnerable_customer": vulnerable_customer,
        "processing_time_ms": complaint.get("total_processing_time_ms"),
        "processing_time_hours": round((complaint.get("total_processing_time_ms") or 0) / 1000 / 3600, 2),
        "age_hours": age_hours,
        "routing_reasoning": routing.get("reasoning"),
        "compliance_reasoning": compliance.get("reasoning"),
    }


def _complaint_matches_filters(summary: dict, product: Optional[str], risk_level: Optional[str],
                               customer_state: Optional[str], channel: Optional[str],
                               tag: Optional[str], vulnerable_only: bool,
                               needs_review: Optional[bool], high_risk: Optional[bool],
                               sla_risk: Optional[bool]) -> bool:
    """Apply triage filters to a complaint summary."""
    if product and summary.get("product") != product:
        return False
    if risk_level and summary.get("risk_level") != risk_level:
        return False
    if customer_state and summary.get("customer_state") != customer_state:
        return False
    if channel and summary.get("channel") != channel:
        return False
    if tag and tag.lower() not in [item.lower() for item in summary.get("tags", [])]:
        return False
    if vulnerable_only and not summary.get("vulnerable_customer"):
        return False
    if needs_review is not None and summary.get("needs_human_review") is not needs_review:
        return False
    if high_risk is not None and summary.get("high_regulatory_risk") is not high_risk:
        return False
    if sla_risk is not None and summary.get("sla_breach_risk") is not sla_risk:
        return False
    return True


def _build_filter_options(summaries: list[dict]) -> dict:
    """Build filter option lists for the batch triage UI."""
    return {
        "products": sorted({item["product"] for item in summaries if item.get("product")}),
        "risk_levels": sorted({item["risk_level"] for item in summaries if item.get("risk_level")}),
        "states": sorted({item["customer_state"] for item in summaries if item.get("customer_state")}),
        "channels": sorted({item["channel"] for item in summaries if item.get("channel")}),
        "tags": sorted({tag for item in summaries for tag in item.get("tags", [])}),
    }


def _build_supervisor_snapshot(summaries: list[dict], queue_limit: int = 6) -> dict:
    """Aggregate queue-level signals for the supervisor dashboard."""
    needs_review = sorted(
        [item for item in summaries if item["needs_human_review"]],
        key=lambda item: (
            item.get("qa_passed") is not False,
            -(item.get("risk_score") or 0),
            -(item.get("age_hours") or 0),
        ),
    )
    high_risk = sorted(
        [item for item in summaries if item["high_regulatory_risk"]],
        key=lambda item: (-(item.get("risk_score") or 0), -(item.get("age_hours") or 0)),
    )
    sla_risk = sorted(
        [item for item in summaries if item["sla_breach_risk"]],
        key=lambda item: (-(item.get("age_hours") or 0), item.get("sla_hours") or 999),
    )

    return {
        "counts": {
            "needs_human_review": len(needs_review),
            "high_regulatory_risk": len(high_risk),
            "sla_breach_risk": len(sla_risk),
            "vulnerable_customer_cases": sum(1 for item in summaries if item["vulnerable_customer"]),
        },
        "queues": {
            "needs_human_review": needs_review[:queue_limit],
            "high_regulatory_risk": high_risk[:queue_limit],
            "sla_breach_risk": sla_risk[:queue_limit],
        },
    }


# ──────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "complaint-categorization-ai"}


@app.get("/api/complaints/samples")
async def get_samples():
    """Get all sample CFPB complaints."""
    samples = []
    for c in SAMPLE_COMPLAINTS:
        samples.append({
            "id": c["id"],
            "narrative": c["narrative"],
            "narrative_preview": c["narrative"][:150] + "...",
            "product": c.get("product", ""),
            "channel": c.get("channel", "web"),
            "customer_state": c.get("customer_state", ""),
            "tags": c.get("tags", []),
            "date_received": c.get("date_received", ""),
        })
    return {"samples": samples, "total": len(samples)}


@app.post("/api/complaints/analyze")
async def analyze_complaint(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Submit a complaint for full agent pipeline analysis.
    Returns complaint_id immediately; use SSE endpoint to stream progress.
    """
    if not OPENAI_API_KEY or OPENAI_API_KEY == "your-api-key-here":
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    if not request.narrative.strip():
        raise HTTPException(status_code=400, detail="Complaint narrative is required")

    metadata = {
        "id": request.complaint_id,
        "product": request.product,
        "channel": request.channel,
        "customer_state": request.customer_state,
        "customer_id": request.customer_id,
        "date_received": request.date_received,
        "tags": request.tags,
    }

    # Start processing in background
    complaint_id = request.complaint_id or f"CMP-{id(request) % 100000:05d}"
    metadata["id"] = complaint_id

    background_tasks.add_task(
        orchestrator.process_complaint,
        narrative=request.narrative,
        metadata=metadata
    )

    return {
        "complaint_id": complaint_id,
        "status": "processing",
        "message": "Complaint submitted for analysis. Use SSE endpoint to stream progress."
    }


@app.post("/api/complaints/analyze/sync")
async def analyze_complaint_sync(request: AnalyzeRequest):
    """
    Submit a complaint and wait for full analysis (synchronous).
    Use this for direct results without SSE.
    """
    if not OPENAI_API_KEY or OPENAI_API_KEY == "your-api-key-here":
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    if not request.narrative.strip():
        raise HTTPException(status_code=400, detail="Complaint narrative is required")

    metadata = {
        "id": request.complaint_id,
        "product": request.product,
        "channel": request.channel,
        "customer_state": request.customer_state,
        "customer_id": request.customer_id,
        "date_received": request.date_received,
        "tags": request.tags,
    }

    result = await orchestrator.process_complaint(
        narrative=request.narrative,
        metadata=metadata
    )

    return result


@app.get("/api/complaints/analyze/{complaint_id}/stream")
async def stream_analysis(complaint_id: str):
    """SSE endpoint to stream agent progress for a complaint."""

    async def event_generator():
        last_index = 0
        max_wait = 300  # 5 minutes max
        waited = 0

        while waited < max_wait:
            events = orchestrator.get_events(complaint_id)

            # Send any new events
            while last_index < len(events):
                event = events[last_index]
                yield {
                    "event": "agent_update",
                    "data": json.dumps(event)
                }
                last_index += 1

                # Check if pipeline completed or failed
                if event.get("agent") == "Orchestrator" and event.get("status") in ("completed", "failed"):
                    # Send final result
                    full_result = get_complaint(complaint_id)
                    yield {
                        "event": "analysis_complete",
                        "data": json.dumps(full_result if full_result else {"error": "Result not found"})
                    }
                    orchestrator.cleanup_job(complaint_id)
                    return

            await asyncio.sleep(0.5)
            waited += 0.5

        yield {
            "event": "timeout",
            "data": json.dumps({"message": "Analysis timed out"})
        }

    return EventSourceResponse(event_generator())


@app.get("/api/complaints")
async def list_complaints(limit: int = 50, offset: int = 0,
                          product: Optional[str] = None,
                          risk_level: Optional[str] = None,
                          customer_state: Optional[str] = None,
                          channel: Optional[str] = None,
                          tag: Optional[str] = None,
                          vulnerable_only: bool = False,
                          needs_review: Optional[bool] = None,
                          high_risk: Optional[bool] = None,
                          sla_risk: Optional[bool] = None):
    """List all processed complaints with summary data."""
    complaints = get_all_complaints(limit=max(limit + offset, 200), offset=0)
    summaries = [_build_complaint_summary(complaint) for complaint in complaints]
    filtered = [
        summary for summary in summaries
        if _complaint_matches_filters(
            summary, product, risk_level, customer_state,
            channel, tag, vulnerable_only, needs_review,
            high_risk, sla_risk
        )
    ]
    window = filtered[offset:offset + limit]

    return {
        "complaints": window,
        "total": len(filtered),
        "available_filters": _build_filter_options(summaries),
    }


@app.get("/api/complaints/{complaint_id}")
async def get_complaint_detail(complaint_id: str):
    """Get full analysis for a specific complaint."""
    result = get_complaint(complaint_id)
    if not result:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return result


@app.get("/api/audit/{complaint_id}")
async def get_audit(complaint_id: str):
    """Get full audit trail for a complaint."""
    trail = get_audit_trail(complaint_id)
    if not trail:
        raise HTTPException(status_code=404, detail="No audit trail found")
    return {"complaint_id": complaint_id, "audit_trail": trail}


@app.get("/api/dashboard/stats")
async def dashboard_stats():
    """Get aggregate dashboard statistics."""
    stats = get_dashboard_stats()
    return stats


@app.get("/api/dashboard/trends")
async def dashboard_trends(days: int = 14):
    """Get chart-ready complaint trend data."""
    return get_dashboard_trends(limit_days=days)


@app.get("/api/dashboard/supervisor")
async def dashboard_supervisor(limit: int = 6):
    """Get queue signals for supervisor monitoring."""
    complaints = get_all_complaints(limit=500, offset=0)
    summaries = [_build_complaint_summary(complaint) for complaint in complaints]
    return _build_supervisor_snapshot(summaries, queue_limit=limit)


@app.post("/api/complaints/batch")
async def batch_process(request: BatchRequest, background_tasks: BackgroundTasks):
    """Batch-process multiple sample complaints."""
    if not OPENAI_API_KEY or OPENAI_API_KEY == "your-api-key-here":
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    # Get samples to process
    if request.complaint_ids:
        samples = [s for s in SAMPLE_COMPLAINTS if s["id"] in request.complaint_ids]
    else:
        samples = SAMPLE_COMPLAINTS[:request.count]

    submitted = []
    for sample in samples:
        metadata = {
            "id": sample["id"],
            "product": sample.get("product"),
            "channel": sample.get("channel", "web"),
            "customer_state": sample.get("customer_state"),
            "tags": sample.get("tags", []),
            "date_received": sample.get("date_received"),
        }
        background_tasks.add_task(
            orchestrator.process_complaint,
            narrative=sample["narrative"],
            metadata=metadata
        )
        submitted.append(sample["id"])

    return {
        "submitted": submitted,
        "count": len(submitted),
        "message": f"Submitted {len(submitted)} complaints for processing"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
