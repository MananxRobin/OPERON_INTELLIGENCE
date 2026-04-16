"""
Orchestrator — Coordinates the sequential agent pipeline and manages state.
Supports SSE streaming for real-time frontend updates.
"""
import time
import uuid
from datetime import datetime
import httpx

from backend.agents.classification_agent import ClassificationAgent
from backend.agents.compliance_agent import ComplianceRiskAgent
from backend.agents.routing_agent import RoutingAgent
from backend.agents.resolution_agent import ResolutionAgent
from backend.agents.qa_agent import QAAgent
from backend.database import (
    save_complaint, update_complaint_status,
    save_analysis_result
)


class Orchestrator:
    """Coordinates the 5-agent pipeline for complaint analysis."""

    def __init__(self, api_key: str):
        self.client = httpx.Client(
            base_url="https://api.openai.com/v1/",
            timeout=90.0,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        self.classification_agent = ClassificationAgent(self.client)
        self.compliance_agent = ComplianceRiskAgent(self.client)
        self.routing_agent = RoutingAgent(self.client)
        self.resolution_agent = ResolutionAgent(self.client)
        self.qa_agent = QAAgent(self.client)

        # Active processing state for SSE streaming
        self._active_jobs: dict[str, list[dict]] = {}

    def get_events(self, complaint_id: str) -> list[dict]:
        """Get accumulated events for a complaint."""
        return self._active_jobs.get(complaint_id, [])

    def _emit_event(self, complaint_id: str, event: dict):
        """Add an event to the job's event list."""
        if complaint_id not in self._active_jobs:
            self._active_jobs[complaint_id] = []
        self._active_jobs[complaint_id].append(event)

    async def process_complaint(self, narrative: str, metadata: dict = None) -> dict:
        """
        Run the full agent pipeline on a complaint.
        Returns the complete analysis result.
        """
        if metadata is None:
            metadata = {}

        complaint_id = metadata.get("id") or f"CMP-{uuid.uuid4().hex[:8].upper()}"
        self._active_jobs[complaint_id] = []
        pipeline_start = time.time()

        # Save complaint to DB
        save_complaint(
            complaint_id=complaint_id,
            narrative=narrative,
            product=metadata.get("product"),
            channel=metadata.get("channel", "web"),
            customer_state=metadata.get("customer_state"),
            customer_id=metadata.get("customer_id"),
            date_received=metadata.get("date_received", datetime.utcnow().strftime("%Y-%m-%d")),
            tags=metadata.get("tags", [])
        )
        update_complaint_status(complaint_id, "processing")

        results = {
            "complaint_id": complaint_id,
            "status": "processing",
            "submitted_at": datetime.utcnow().isoformat(),
        }

        try:
            # ── Agent 1: Classification ──
            self._emit_event(complaint_id, {
                "agent": "ClassificationAgent",
                "status": "running",
                "message": "Analyzing complaint narrative for product, issue, severity..."
            })

            classification = await self.classification_agent.run(
                complaint_id=complaint_id,
                narrative=narrative,
                metadata=metadata
            )
            duration = classification.pop("_duration_ms", 0)
            results["classification"] = classification

            self._emit_event(complaint_id, {
                "agent": "ClassificationAgent",
                "status": "completed",
                "message": f"Classified as {classification.get('product')} — {classification.get('issue')}",
                "result": classification,
                "duration_ms": duration
            })

            # ── Agent 2: Compliance Risk ──
            self._emit_event(complaint_id, {
                "agent": "ComplianceRiskAgent",
                "status": "running",
                "message": "Assessing regulatory compliance risk..."
            })

            compliance = await self.compliance_agent.run(
                complaint_id=complaint_id,
                narrative=narrative,
                classification=classification,
                metadata=metadata
            )
            duration = compliance.pop("_duration_ms", 0)
            results["compliance_risk"] = compliance

            self._emit_event(complaint_id, {
                "agent": "ComplianceRiskAgent",
                "status": "completed",
                "message": f"Risk score: {compliance.get('risk_score')}/100 ({compliance.get('risk_level')})",
                "result": compliance,
                "duration_ms": duration
            })

            # ── Agent 3: Routing ──
            self._emit_event(complaint_id, {
                "agent": "RoutingAgent",
                "status": "running",
                "message": "Determining optimal team assignment and priority..."
            })

            routing = await self.routing_agent.run(
                complaint_id=complaint_id,
                narrative=narrative,
                classification=classification,
                compliance=compliance,
                metadata=metadata
            )
            duration = routing.pop("_duration_ms", 0)
            results["routing"] = routing

            self._emit_event(complaint_id, {
                "agent": "RoutingAgent",
                "status": "completed",
                "message": f"Routed to {routing.get('assigned_team')} ({routing.get('priority')})",
                "result": routing,
                "duration_ms": duration
            })

            # ── Agent 4: Resolution ──
            self._emit_event(complaint_id, {
                "agent": "ResolutionAgent",
                "status": "running",
                "message": "Generating resolution plan and customer response..."
            })

            resolution = await self.resolution_agent.run(
                complaint_id=complaint_id,
                narrative=narrative,
                classification=classification,
                compliance=compliance,
                routing=routing
            )
            duration = resolution.pop("_duration_ms", 0)
            results["resolution"] = resolution

            self._emit_event(complaint_id, {
                "agent": "ResolutionAgent",
                "status": "completed",
                "message": f"Resolution plan ready — {resolution.get('estimated_resolution_days')} day estimate",
                "result": resolution,
                "duration_ms": duration
            })

            # ── Agent 5: QA Validation ──
            self._emit_event(complaint_id, {
                "agent": "QAValidationAgent",
                "status": "running",
                "message": "Running quality assurance validation checks..."
            })

            qa = await self.qa_agent.run(
                complaint_id=complaint_id,
                narrative=narrative,
                classification=classification,
                compliance=compliance,
                routing=routing,
                resolution=resolution
            )
            duration = qa.pop("_duration_ms", 0)
            results["qa_validation"] = qa

            self._emit_event(complaint_id, {
                "agent": "QAValidationAgent",
                "status": "completed",
                "message": f"QA score: {qa.get('overall_score', 0):.0%} — {'PASSED' if qa.get('passed') else 'NEEDS REVIEW'}",
                "result": qa,
                "duration_ms": duration
            })

            # ── Finalize ──
            total_time = int((time.time() - pipeline_start) * 1000)
            results["total_processing_time_ms"] = total_time
            results["status"] = "analyzed"
            results["completed_at"] = datetime.utcnow().isoformat()

            # Save to DB
            save_analysis_result(
                complaint_id=complaint_id,
                classification=classification,
                compliance=compliance,
                routing=routing,
                resolution=resolution,
                qa=qa,
                total_time_ms=total_time
            )
            update_complaint_status(complaint_id, "analyzed")

            self._emit_event(complaint_id, {
                "agent": "Orchestrator",
                "status": "completed",
                "message": f"Analysis complete in {total_time/1000:.1f}s",
                "total_processing_time_ms": total_time
            })

            return results

        except Exception as e:
            update_complaint_status(complaint_id, "failed")
            self._emit_event(complaint_id, {
                "agent": "Orchestrator",
                "status": "failed",
                "message": f"Pipeline failed: {str(e)}"
            })
            results["status"] = "failed"
            results["error"] = str(e)
            return results

    def cleanup_job(self, complaint_id: str):
        """Remove completed job from active tracking."""
        self._active_jobs.pop(complaint_id, None)
