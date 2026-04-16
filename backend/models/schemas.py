"""
Pydantic schemas for the complaint categorization system.
Defines all data models used across agents and API endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class PriorityLevel(str, Enum):
    P1_IMMEDIATE = "P1_IMMEDIATE"
    P2_HIGH = "P2_HIGH"
    P3_MEDIUM = "P3_MEDIUM"
    P4_LOW = "P4_LOW"

class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class ComplaintStatus(str, Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    FAILED = "failed"


# ──────────────────────────────────────────────
# Input Models
# ──────────────────────────────────────────────

class ComplaintInput(BaseModel):
    """Raw complaint input from any channel."""
    narrative: str = Field(..., description="The consumer's complaint narrative text")
    product: Optional[str] = Field(None, description="Product category if pre-known")
    channel: str = Field(default="web", description="Intake channel: web, email, phone, cfpb")
    customer_state: Optional[str] = Field(None, description="Customer's state")
    customer_id: Optional[str] = Field(None, description="Internal customer ID")
    date_received: Optional[str] = Field(None, description="Date complaint was received")
    tags: Optional[list[str]] = Field(default_factory=list, description="Special tags: Older American, Servicemember, etc.")


# ──────────────────────────────────────────────
# Agent Output Models
# ──────────────────────────────────────────────

class ClassificationResult(BaseModel):
    """Output from the Classification Agent."""
    product: str = Field(..., description="Financial product category")
    sub_product: str = Field(..., description="Specific product subcategory")
    issue: str = Field(..., description="Primary complaint issue")
    sub_issue: str = Field(..., description="Specific sub-issue")
    severity: SeverityLevel = Field(..., description="Severity level")
    sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment: -1 (very negative) to 1 (positive)")
    urgency: str = Field(..., description="Urgency assessment")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence")
    key_entities: list[str] = Field(default_factory=list, description="Key entities extracted")
    reasoning: str = Field(..., description="Explanation of classification reasoning")


class ComplianceFlag(BaseModel):
    """Individual compliance/regulatory flag."""
    regulation: str = Field(..., description="Regulation code (e.g. UDAAP, TILA, ECOA)")
    regulation_name: str = Field(..., description="Full regulation name")
    description: str = Field(..., description="What was flagged and why")
    evidence_quote: str = Field(..., description="Direct quote from complaint narrative")
    severity: str = Field(..., description="Flag severity")


class ComplianceRiskResult(BaseModel):
    """Output from the Compliance Risk Agent."""
    risk_score: int = Field(..., ge=0, le=100, description="Overall compliance risk score")
    risk_level: RiskLevel = Field(..., description="Risk level category")
    flags: list[ComplianceFlag] = Field(default_factory=list, description="Specific regulatory flags")
    applicable_regulations: list[str] = Field(default_factory=list, description="All applicable regulations")
    requires_escalation: bool = Field(default=False, description="Whether immediate escalation needed")
    reasoning: str = Field(..., description="Regulatory risk reasoning")


class RoutingResult(BaseModel):
    """Output from the Routing Agent."""
    assigned_team: str = Field(..., description="Team name to route complaint to")
    assigned_tier: str = Field(..., description="Agent tier: Junior, Senior, Manager, Legal")
    priority: PriorityLevel = Field(..., description="Priority level")
    sla_hours: int = Field(..., description="SLA deadline in hours")
    escalation_path: list[str] = Field(default_factory=list, description="Escalation chain if needed")
    requires_immediate_attention: bool = Field(default=False)
    reasoning: str = Field(..., description="Routing reasoning")


class ResolutionResult(BaseModel):
    """Output from the Resolution Agent."""
    action_plan: list[str] = Field(..., description="Ordered list of resolution steps")
    customer_response: str = Field(..., description="Customer-facing response letter")
    internal_notes: str = Field(..., description="Internal notes for handling team")
    preventive_recommendations: list[str] = Field(default_factory=list, description="Recommendations to prevent recurrence")
    estimated_resolution_days: int = Field(..., description="Estimated days to resolve")
    remediation_amount: Optional[str] = Field(None, description="Estimated remediation if applicable")
    reasoning: str = Field(..., description="Resolution reasoning")


class QACheck(BaseModel):
    """Individual QA validation check."""
    check_name: str = Field(..., description="Name of the quality check")
    passed: bool = Field(..., description="Whether the check passed")
    details: str = Field(..., description="Check details and findings")


class QAResult(BaseModel):
    """Output from the QA/Validation Agent."""
    overall_score: float = Field(..., ge=0.0, le=1.0, description="Overall quality score")
    checks: list[QACheck] = Field(default_factory=list, description="Individual validation checks")
    passed: bool = Field(..., description="Whether all critical checks passed")
    improvements: list[str] = Field(default_factory=list, description="Suggested improvements")
    reasoning: str = Field(..., description="QA reasoning")


# ──────────────────────────────────────────────
# Aggregated Models
# ──────────────────────────────────────────────

class AgentProgress(BaseModel):
    """Real-time progress update from an agent."""
    agent_name: str
    status: AgentStatus
    message: str = ""
    result: Optional[dict] = None
    duration_ms: Optional[int] = None


class AuditTrailEntry(BaseModel):
    """One entry in the explainability audit trail."""
    agent_name: str
    timestamp: str
    decision: str
    confidence: Optional[float] = None
    reasoning: str
    evidence_spans: list[str] = Field(default_factory=list)
    input_summary: str = ""
    output_summary: str = ""


class FullAnalysis(BaseModel):
    """Complete analysis result from the entire agent pipeline."""
    complaint_id: str
    status: ComplaintStatus
    submitted_at: str
    completed_at: Optional[str] = None
    complaint: ComplaintInput
    classification: Optional[ClassificationResult] = None
    compliance_risk: Optional[ComplianceRiskResult] = None
    routing: Optional[RoutingResult] = None
    resolution: Optional[ResolutionResult] = None
    qa_validation: Optional[QAResult] = None
    audit_trail: list[AuditTrailEntry] = Field(default_factory=list)
    total_processing_time_ms: Optional[int] = None


# ──────────────────────────────────────────────
# Dashboard / API Response Models
# ──────────────────────────────────────────────

class DashboardStats(BaseModel):
    """Aggregate dashboard statistics."""
    total_complaints: int = 0
    complaints_today: int = 0
    avg_resolution_time_hrs: float = 0.0
    compliance_flags_caught: int = 0
    auto_resolution_rate: float = 0.0
    critical_risk_count: int = 0
    high_risk_count: int = 0
    timely_response_rate: float = 0.0
    product_distribution: dict[str, int] = Field(default_factory=dict)
    severity_distribution: dict[str, int] = Field(default_factory=dict)
    risk_distribution: dict[str, int] = Field(default_factory=dict)
    team_distribution: dict[str, int] = Field(default_factory=dict)


class ComplaintSummary(BaseModel):
    """Summary view of a complaint for list displays."""
    complaint_id: str
    status: str
    product: Optional[str] = None
    issue: Optional[str] = None
    severity: Optional[str] = None
    risk_level: Optional[str] = None
    risk_score: Optional[int] = None
    assigned_team: Optional[str] = None
    submitted_at: str
    narrative_preview: str = ""
