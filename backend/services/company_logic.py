"""
Deterministic company-facing enrichment logic.

These helpers make the complaint operations product useful even when the
upstream LLM pipeline is unavailable or returns sparse outputs. They provide
customer dossier generation, internal team routing context, explainability
support, dashboard aggregations, and stable summary shapes for the frontend.
"""

from __future__ import annotations

import hashlib
import random
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.services.ticketing import build_ticket


TEAM_CATALOG: List[Dict[str, Any]] = [
    {"code": "EXEC", "name": "Executive Response Team", "focus": "CFPB escalations, executive complaints, regulator-sensitive narratives", "queue": "Executive Escalations"},
    {"code": "REG", "name": "Regulatory Compliance Team", "focus": "UDAAP, ECOA, FCRA, Reg E, FDCPA and policy interpretation", "queue": "Regulatory Review"},
    {"code": "CARDOPS", "name": "Card Operations Team", "focus": "APR, fees, limits, rewards, card servicing", "queue": "Card Servicing"},
    {"code": "CARDDISP", "name": "Card Disputes Team", "focus": "Chargebacks, duplicate billing, merchant disputes", "queue": "Card Disputes"},
    {"code": "FRAUD", "name": "Fraud Investigation Team", "focus": "Unauthorized access, identity theft, account takeover", "queue": "Fraud Queue"},
    {"code": "RETBANK", "name": "Retail Banking Operations Team", "focus": "Checking, savings, ACH, wire, overdraft and deposits", "queue": "Deposit Operations"},
    {"code": "DIGITAL", "name": "Digital Experience Team", "focus": "App, web, login, verification, AI chat and onboarding issues", "queue": "Digital Support"},
    {"code": "LENDING", "name": "Lending Operations Team", "focus": "Personal loans, installment lending, servicing and repayment", "queue": "Consumer Lending"},
    {"code": "MORTGAGE", "name": "Mortgage Servicing Team", "focus": "Escrow, foreclosure, payoff, modification, dual tracking", "queue": "Mortgage Servicing"},
    {"code": "STUDENT", "name": "Student Lending Team", "focus": "IDR, PSLF, student loan servicing, deferment and errors", "queue": "Student Lending"},
    {"code": "COLLECT", "name": "Collections Compliance Team", "focus": "Debt collection conduct, validation notices, communication tactics", "queue": "Collections Compliance"},
    {"code": "RETENTION", "name": "Customer Retention Team", "focus": "Repeat complainants, churn-risk customers, service recovery", "queue": "Retention"},
    {"code": "VULNERABLE", "name": "Vulnerable Customer Care Team", "focus": "Older Americans, servicemembers, hardship cases", "queue": "Protected Populations"},
    {"code": "IDENTITY", "name": "Identity & Access Support Team", "focus": "Authentication, KYC failures, profile access and verification", "queue": "Identity Support"},
    {"code": "QA", "name": "Quality Assurance & Controls Team", "focus": "QA failures, process drift, repeat control breaks", "queue": "Controls Review"},
]

TEAM_LOOKUP = {team["name"]: team for team in TEAM_CATALOG}

FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Cameron", "Skyler", "Riley",
    "Avery", "Parker", "Drew", "Logan", "Sam", "Jamie", "Harper", "Rowan",
]
LAST_NAMES = [
    "Patel", "Johnson", "Lee", "Garcia", "Williams", "Kim", "Brown", "Miller",
    "Davis", "Nguyen", "Walker", "Thomas", "Jackson", "Clark", "Lopez", "Allen",
]


def _seed(complaint_id: str) -> random.Random:
    value = int(hashlib.sha256(complaint_id.encode("utf-8")).hexdigest()[:12], 16)
    return random.Random(value)


def derive_customer_id(complaint_id: str, complaint: Dict[str, Any], classification: Dict[str, Any]) -> str:
    explicit = (complaint.get("customer_id") or "").strip()
    if explicit:
        return explicit

    state = (complaint.get("customer_state") or "NA").upper()
    product = (classification.get("product") or complaint.get("product") or "general").lower()
    issue = (classification.get("issue") or "service handling").lower()
    complaint_bucket = int(hashlib.sha1(complaint_id.encode("utf-8")).hexdigest()[-2:], 16) % 10
    identity_key = f"{state}|{product}|{issue[:18]}|{complaint_bucket}"
    digest = hashlib.sha1(identity_key.encode("utf-8")).hexdigest().upper()
    return f"CUST-{digest[:6]}"


def _find_span(narrative: str, fragment: str, label: str, source: str) -> Optional[Dict[str, Any]]:
    if not narrative or not fragment:
        return None
    match = re.search(re.escape(fragment), narrative, flags=re.IGNORECASE)
    if not match:
        return None
    return {
        "quote": narrative[match.start():match.end()],
        "start": match.start(),
        "end": match.end(),
        "label": label,
        "source": source,
    }


def _extract_amounts(narrative: str) -> List[str]:
    return re.findall(r"\$\s?\d[\d,]*(?:\.\d{2})?", narrative or "")


def derive_root_cause(narrative: str, classification: Dict[str, Any], compliance: Dict[str, Any]) -> Dict[str, Any]:
    lower = (narrative or "").lower()
    issue = (classification.get("issue") or "").lower()

    rules = [
        ("access_failure", ["locked out", "could not log in", "verification code", "authentication", "password reset"]),
        ("billing_breakdown", ["double-charg", "billing", "apr", "fee", "interest", "statement"]),
        ("fraud_incident", ["unauthorized", "stolen", "fraud", "identity theft", "account takeover"]),
        ("servicing_error", ["misappl", "loan servicing", "escrow", "payment posted", "modification"]),
        ("collection_misconduct", ["collector", "harass", "validation notice", "communication tactics", "collections"]),
        ("fair_lending_risk", ["discrimin", "minority", "redlining", "adverse action", "fair lending"]),
        ("digital_experience_gap", ["app crashed", "mobile app", "website", "zelle", "chatbot", "transfer failed"]),
    ]

    for code, markers in rules:
        if any(marker in lower or marker in issue for marker in markers):
            return {
                "code": code,
                "label": code.replace("_", " ").title(),
                "reason": f"Primary narrative signals indicate {code.replace('_', ' ')}.",
            }

    if (compliance.get("risk_level") or "") in {"HIGH", "CRITICAL"}:
        return {"code": "compliance_exposure", "label": "Compliance Exposure", "reason": "Elevated compliance exposure is the leading driver of operational handling."}

    return {"code": "service_failure", "label": "Service Failure", "reason": "General service handling breakdown inferred from complaint narrative."}


def build_customer_profile(
    complaint_id: str,
    complaint: Dict[str, Any],
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    customer_id = derive_customer_id(complaint_id, complaint, classification)
    rng = _seed(customer_id)
    risk_score = int(compliance.get("risk_score") or summary.get("risk_score") or 42 if summary else compliance.get("risk_score") or 42)
    full_name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
    segment = rng.choice(["Mass Market", "Prime", "Affluent", "Emerging Credit", "Small Business"])
    credit_score = max(540, min(830, 760 - int(risk_score * 1.4) + rng.randint(-25, 25)))
    delinquency_days = max(0, min(120, int((risk_score - 25) * 1.2) + rng.randint(-8, 12)))
    prior_complaints = max(0, rng.randint(0, 5) + (1 if risk_score >= 70 else 0))
    default_probability = round(min(0.82, max(0.01, (risk_score / 130) + (delinquency_days / 500))), 2)
    relationship_months = rng.randint(8, 164)
    annual_income = rng.randint(38_000, 210_000)
    deposit_balance = rng.randint(1_200, 62_000)
    revolving_balance = rng.randint(0, 18_000)
    loan_balance = rng.randint(0, 310_000)
    utilization = round(min(0.98, max(0.05, revolving_balance / max(1, rng.randint(8_000, 24_000)))), 2)
    open_products = sorted(set([
        classification.get("product") or complaint.get("product") or rng.choice(["Credit card", "Checking account", "Personal loan"]),
        rng.choice(["Checking account", "Savings account", "Credit card", "Personal loan", "Mortgage"]),
        rng.choice(["Digital wallet", "Rewards card", "Auto loan", "Savings account"]),
    ]))
    tier = "High-touch" if risk_score >= 72 else "Standard"
    hardship = delinquency_days >= 30 or "hardship" in (complaint.get("narrative") or "").lower()

    return {
        "customer_id": customer_id,
        "full_name": full_name,
        "segment": segment,
        "service_tier": tier,
        "credit_score": credit_score,
        "delinquency_days": delinquency_days,
        "default_probability": default_probability,
        "previous_complaints_count": prior_complaints,
        "prior_regulatory_flags": rng.randint(0, 3) if risk_score >= 65 else rng.randint(0, 1),
        "account_tenure_months": relationship_months,
        "annual_income_usd": annual_income,
        "relationship_value_usd": rng.randint(2_000, 45_000),
        "open_products_count": len(open_products),
        "open_products": open_products,
        "deposit_balance_usd": deposit_balance,
        "revolving_balance_usd": revolving_balance,
        "loan_balance_usd": loan_balance,
        "credit_utilization_ratio": utilization,
        "autopay_enrolled": rng.choice([True, True, False]),
        "hardship_program": hardship,
        "kyc_tier": rng.choice(["KYC2", "KYC3", "Enhanced Due Diligence"]),
        "fraud_watch": risk_score >= 74 or "fraud" in (complaint.get("narrative") or "").lower(),
        "state": complaint.get("customer_state"),
        "preferred_channel": complaint.get("channel", "web"),
        "next_payment_due": (datetime.utcnow() + timedelta(days=rng.randint(2, 24))).strftime("%Y-%m-%d"),
    }


def build_baseline(
    complaint: Dict[str, Any],
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
) -> Dict[str, Any]:
    product = (classification.get("product") or complaint.get("product") or "").lower()
    issue = (classification.get("issue") or "").lower()
    channel = (complaint.get("channel") or "web").lower()
    tags = [str(tag).lower() for tag in (complaint.get("tags") or [])]
    risk_score = int(compliance.get("risk_score") or 40)
    severity = classification.get("severity") or ("HIGH" if risk_score >= 65 else "MEDIUM")

    assigned_team = "Retail Banking Operations Team"
    reasons = []
    factors = []

    def add_factor(code: str, points: int, reason: str):
        factors.append({"code": code, "points": points, "reason": reason})
        reasons.append(reason)

    if channel == "cfpb":
        assigned_team = "Executive Response Team"
        add_factor("channel_cfpb", 12, "CFPB-originated complaints default into executive-response handling.")
    if "credit card" in product:
        assigned_team = "Card Operations Team"
        add_factor("product_card", 10, "Card complaints baseline into card operations.")
    if any(marker in issue for marker in ["billing", "charge", "dispute"]):
        assigned_team = "Card Disputes Team"
        add_factor("issue_dispute", 14, "Billing and dispute issues route to specialized disputes handling.")
    if any(marker in issue for marker in ["fraud", "unauthorized"]):
        assigned_team = "Fraud Investigation Team"
        add_factor("issue_fraud", 20, "Fraud markers override other team choices.")
    if "mortgage" in product:
        assigned_team = "Mortgage Servicing Team"
        add_factor("product_mortgage", 12, "Mortgage servicing and escrow complaints stay in mortgage ops.")
    if "student loan" in product:
        assigned_team = "Student Lending Team"
        add_factor("product_student", 10, "Student loan servicing routes to the student lending desk.")
    if "debt collection" in product:
        assigned_team = "Collections Compliance Team"
        add_factor("product_collection", 14, "Collections issues route to collections compliance.")
    if any(tag in tags for tag in ["older american", "servicemember"]):
        add_factor("protected_tag", 10, "Protected-population tags require a higher-touch workflow.")
    if risk_score >= 76:
        assigned_team = "Regulatory Compliance Team"
        add_factor("risk_critical", 18, "Critical regulatory exposure pushes baseline routing to compliance.")

    priority = "P4_LOW"
    if risk_score >= 76 or severity == "CRITICAL":
        priority = "P1_IMMEDIATE"
    elif risk_score >= 56 or severity == "HIGH":
        priority = "P2_HIGH"
    elif severity == "MEDIUM":
        priority = "P3_MEDIUM"

    assigned_tier = {
        "P1_IMMEDIATE": "Legal",
        "P2_HIGH": "Manager",
        "P3_MEDIUM": "Senior",
        "P4_LOW": "Junior",
    }[priority]
    sla_hours = {
        "P1_IMMEDIATE": 4,
        "P2_HIGH": 24,
        "P3_MEDIUM": 48,
        "P4_LOW": 72,
    }[priority]
    review_outcome = "Needs Human Review" if assigned_tier != "Junior" or risk_score >= 60 else "Auto Clear"

    return {
        "severity": severity,
        "risk_level": "CRITICAL" if risk_score >= 76 else "HIGH" if risk_score >= 56 else "MEDIUM" if risk_score >= 35 else "LOW",
        "risk_score": risk_score,
        "assigned_team": assigned_team,
        "assigned_tier": assigned_tier,
        "priority": priority,
        "sla_hours": sla_hours,
        "review_outcome": review_outcome,
        "factors": factors,
        "reasoning": " ".join(reasons) or "Baseline workflow uses product, issue, channel, and regulatory signals.",
    }


def build_criticality(
    complaint: Dict[str, Any],
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    baseline: Dict[str, Any],
    customer_profile: Dict[str, Any],
) -> Dict[str, Any]:
    risk_score = int(compliance.get("risk_score") or baseline.get("risk_score") or 40)
    tags = [str(tag).lower() for tag in (complaint.get("tags") or [])]
    prior = int(customer_profile.get("previous_complaints_count") or 0)
    delinquency = int(customer_profile.get("delinquency_days") or 0)

    components = [
        {
            "code": "regulatory_risk",
            "label": "Regulatory Risk",
            "score": max(4, min(25, round(risk_score / 4))),
            "reason": "Derived from complaint risk score and applicable regulations.",
        },
        {
            "code": "customer_harm",
            "label": "Customer Harm",
            "score": 18 if classification.get("severity") == "CRITICAL" else 12 if classification.get("severity") == "HIGH" else 7,
            "reason": "Severity and financial harm signals shape customer-impact urgency.",
        },
        {
            "code": "sla_exposure",
            "label": "SLA Exposure",
            "score": 12 if risk_score >= 70 else 8 if risk_score >= 55 else 4,
            "reason": "Higher-risk complaints receive tighter response windows and operational pressure.",
        },
        {
            "code": "vulnerable_customer",
            "label": "Vulnerable Customer",
            "score": 12 if any(tag in tags for tag in ["older american", "servicemember"]) else 4,
            "reason": "Protected or vulnerable-tagged complaints carry higher oversight requirements.",
        },
        {
            "code": "repeat_pattern",
            "label": "Repeat Pattern",
            "score": min(12, 4 + prior * 2),
            "reason": "Repeat complaints and delinquencies increase operational criticality.",
        },
        {
            "code": "credit_stress",
            "label": "Credit Stress",
            "score": min(12, 4 + int(delinquency / 15)),
            "reason": "Delinquency and repayment strain indicate higher customer and business risk.",
        },
    ]

    total = min(100, sum(component["score"] for component in components))
    level = "CRITICAL" if total >= 78 else "HIGH" if total >= 58 else "MEDIUM" if total >= 35 else "LOW"

    return {
        "score": total,
        "level": level,
        "components": components,
        "sla_breach_risk": total >= 60 or risk_score >= 70,
        "reasoning": "Criticality blends regulatory exposure, harm, timeliness, vulnerability, repeat-pattern, and credit-stress signals.",
    }


def build_review_gate(
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    qa: Dict[str, Any],
    evidence_map: Dict[str, Any],
    baseline: Dict[str, Any],
    routing: Dict[str, Any],
    criticality: Dict[str, Any],
) -> Dict[str, Any]:
    reasons: List[str] = []

    if qa and qa.get("passed") is False:
        reasons.append("QA_FAILED")
    if float(classification.get("confidence") or 0) < 0.78:
        reasons.append("LOW_CONFIDENCE")
    if (compliance.get("risk_level") or "") == "CRITICAL":
        reasons.append("CRITICAL_REGULATORY_RISK")
    if sum(len(evidence_map.get(key, [])) for key in ("severity", "compliance", "routing")) < 2:
        reasons.append("WEAK_EVIDENCE_SUPPORT")
    comparison = baseline.get("comparison") or {}
    if int(comparison.get("divergence_score") or 0) >= 3:
        reasons.append("BASELINE_DIVERGENCE")
    if criticality.get("score", 0) >= 80:
        reasons.append("CRITICALITY_THRESHOLD")

    queues = []
    if reasons:
        queues.append("Needs Human Review")
    if (compliance.get("risk_level") or "") in {"HIGH", "CRITICAL"}:
        queues.append("High Regulatory Risk")
    if criticality.get("sla_breach_risk"):
        queues.append("SLA Breach Risk")
    if routing.get("assigned_team") == "Vulnerable Customer Care Team":
        queues.append("Protected Population Review")

    because = (
        "Human review required because " + ", ".join(reason.lower().replace("_", " ") for reason in reasons[:3])
        if reasons
        else "Complaint can proceed through the standard workflow without manual review."
    )

    return {
        "needs_human_review": bool(reasons),
        "review_reason_codes": reasons,
        "queues": queues,
        "sla_breach_risk": bool(criticality.get("sla_breach_risk")),
        "status": "pending_review" if reasons else "auto_clear",
        "because": because,
    }


def build_evidence_map(
    complaint: Dict[str, Any],
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    routing: Dict[str, Any],
    review_reasons: Optional[List[str]] = None,
) -> Dict[str, Any]:
    narrative = complaint.get("narrative") or ""
    severity_refs = []
    compliance_refs = []
    routing_refs = []
    review_refs = []

    for entity in classification.get("key_entities") or _extract_amounts(narrative)[:3]:
        span = _find_span(narrative, entity, "Key entity", "classification")
        if span:
            severity_refs.append(span)

    issue = classification.get("issue") or ""
    if issue:
        for part in [part.strip() for part in issue.split("/") if part.strip()]:
            span = _find_span(narrative, part, "Issue cue", "classification")
            if span:
                severity_refs.append(span)

    for flag in compliance.get("flags") or []:
        fragment = flag.get("evidence_quote") or flag.get("description") or flag.get("regulation")
        span = _find_span(narrative, fragment, flag.get("regulation_name") or flag.get("regulation") or "Compliance flag", "compliance")
        if span:
            compliance_refs.append(span)

    routing_signal = routing.get("assigned_team") or routing.get("reasoning") or ""
    for cue in [classification.get("product"), classification.get("issue"), complaint.get("channel")]:
        if cue:
            span = _find_span(narrative, cue, "Routing cue", "routing")
            if span:
                routing_refs.append(span)
    if not routing_refs and routing_signal:
        routing_refs.extend(compliance_refs[:1] or severity_refs[:1])

    for reason in review_reasons or []:
        if reason == "CRITICAL_REGULATORY_RISK" and compliance_refs:
            review_refs.append(compliance_refs[0])
        elif reason == "LOW_CONFIDENCE" and severity_refs:
            review_refs.append(severity_refs[0])
        elif reason == "WEAK_EVIDENCE_SUPPORT" and routing_refs:
            review_refs.append(routing_refs[0])

    return {
        "severity": severity_refs[:4],
        "compliance": compliance_refs[:4],
        "routing": routing_refs[:4],
        "review": review_refs[:4],
        "narrative_length": len(narrative),
    }


def build_internal_team_packet(
    complaint: Dict[str, Any],
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    routing: Dict[str, Any],
    review_gate: Dict[str, Any],
    customer_profile: Dict[str, Any],
) -> Dict[str, Any]:
    primary_name = routing.get("assigned_team") or "Retail Banking Operations Team"
    primary_team = TEAM_LOOKUP.get(primary_name, TEAM_CATALOG[0])
    handoffs: List[Dict[str, Any]] = []

    def add_handoff(name: str, role: str, reason: str, status: str = "queued"):
        team = TEAM_LOOKUP.get(name)
        if not team or team["name"] == primary_name:
            return
        handoffs.append({
            "team_code": team["code"],
            "team_name": team["name"],
            "queue": team["queue"],
            "role": role,
            "handoff_reason": reason,
            "status": status,
        })

    if (compliance.get("risk_level") or "") in {"HIGH", "CRITICAL"}:
        add_handoff("Regulatory Compliance Team", "control review", "High-risk complaints require compliance oversight.")
    if customer_profile.get("fraud_watch"):
        add_handoff("Fraud Investigation Team", "investigation", "Customer profile and narrative indicate fraud-related risk.")
    if any(tag in [str(t).lower() for t in complaint.get("tags") or []] for tag in ["older american", "servicemember"]):
        add_handoff("Vulnerable Customer Care Team", "special handling", "Protected-population tag requires higher-touch servicing.")
    if review_gate.get("needs_human_review"):
        add_handoff("Quality Assurance & Controls Team", "control escalation", "Review-gate conditions require QA/controls follow-up.")
    if customer_profile.get("previous_complaints_count", 0) >= 2:
        add_handoff("Customer Retention Team", "service recovery", "Repeat complainant should receive retention outreach.")

    return {
        "primary_team": {
            "team_code": primary_team["code"],
            "team_name": primary_team["name"],
            "queue": primary_team["queue"],
            "focus": primary_team["focus"],
            "priority": routing.get("priority"),
            "sla_hours": routing.get("sla_hours"),
            "work_item_status": "active",
        },
        "handoffs": handoffs,
        "team_catalog": TEAM_CATALOG,
        "data_bundle": {
            "customer_profile": True,
            "credit_risk": True,
            "delinquency": True,
            "account_overview": True,
            "previous_complaints": True,
            "complaint_narrative": True,
            "regulatory_flags": True,
        },
    }


def build_source_metadata(complaint: Dict[str, Any]) -> Dict[str, Any]:
    channel = complaint.get("channel", "web")
    source = "manual_analysis"
    if channel == "cfpb":
        source = "live_cfpb"
    return {
        "source": source,
        "source_label": "live operations intake" if source == "manual_analysis" else "cfpb complaint feed",
        "channel": channel,
        "tags": complaint.get("tags", []),
        "issue": complaint.get("issue"),
    }


def build_detail_enrichment(detail: Dict[str, Any]) -> Dict[str, Any]:
    complaint = detail.get("complaint", {}) or {}
    complaint_with_narrative = {**complaint, "narrative": complaint.get("narrative", "")}
    classification = detail.get("classification") or {}
    compliance = detail.get("compliance_risk") or {}
    routing = detail.get("routing") or {}
    qa = detail.get("qa_validation") or {}

    baseline = build_baseline(complaint_with_narrative, classification, compliance)
    baseline_comparison = {
        "changed_fields": [
            field for field, ai_value, baseline_value in [
                ("severity", classification.get("severity"), baseline.get("severity")),
                ("risk_level", compliance.get("risk_level"), baseline.get("risk_level")),
                ("assigned_team", routing.get("assigned_team"), baseline.get("assigned_team")),
                ("priority", routing.get("priority"), baseline.get("priority")),
                ("sla_hours", routing.get("sla_hours"), baseline.get("sla_hours")),
            ]
            if ai_value and baseline_value and ai_value != baseline_value
        ],
    }
    baseline_comparison["risk_score_delta"] = int(compliance.get("risk_score") or baseline.get("risk_score") or 0) - int(baseline.get("risk_score") or 0)
    baseline_comparison["routing_changed"] = routing.get("assigned_team") != baseline.get("assigned_team")
    baseline_comparison["severity_changed"] = classification.get("severity") != baseline.get("severity")
    baseline_comparison["sla_changed"] = routing.get("sla_hours") != baseline.get("sla_hours")
    baseline_comparison["divergence_score"] = len(baseline_comparison["changed_fields"])
    baseline["comparison"] = baseline_comparison

    customer_profile = build_customer_profile(detail["complaint_id"], complaint_with_narrative, classification, compliance)
    criticality = build_criticality(complaint_with_narrative, classification, compliance, baseline, customer_profile)
    evidence_map = build_evidence_map(complaint_with_narrative, classification, compliance, routing, [])
    review_gate = build_review_gate(classification, compliance, qa, evidence_map, baseline, routing, criticality)
    evidence_map = build_evidence_map(complaint_with_narrative, classification, compliance, routing, review_gate["review_reason_codes"])
    internal_teams = build_internal_team_packet(complaint_with_narrative, classification, compliance, routing, review_gate, customer_profile)
    root_cause = derive_root_cause(complaint_with_narrative.get("narrative", ""), classification, compliance)
    source_metadata = build_source_metadata(complaint_with_narrative)
    ticket = build_ticket(
        {**detail, "review_gate": review_gate},
        customer_id=customer_profile.get("customer_id"),
        owner_team=(internal_teams.get("primary_team") or {}).get("team_name") or routing.get("assigned_team") or "Unassigned",
        queue=(internal_teams.get("primary_team") or {}).get("queue") or "Complaint Operations",
        priority=routing.get("priority") or baseline.get("priority"),
        sla_hours=routing.get("sla_hours") or baseline.get("sla_hours"),
    )

    return {
        "baseline": baseline,
        "criticality": criticality,
        "review_gate": review_gate,
        "evidence_map": evidence_map,
        "source_metadata": source_metadata,
        "customer_profile": customer_profile,
        "internal_teams": internal_teams,
        "root_cause": root_cause,
        "normalization": None,
        "ticket": ticket,
    }


def build_summary_from_detail(detail: Dict[str, Any]) -> Dict[str, Any]:
    enrichment = build_detail_enrichment(detail)
    complaint = detail.get("complaint", {})
    classification = detail.get("classification") or {}
    compliance = detail.get("compliance_risk") or {}
    routing = detail.get("routing") or {}

    tags = complaint.get("tags", []) or []
    vulnerable_tags = [tag for tag in tags if str(tag).lower() in {"older american", "servicemember"}]

    return {
        "complaint_id": detail["complaint_id"],
        "status": detail["status"],
        "product": classification.get("product") or complaint.get("product"),
        "issue": classification.get("issue"),
        "severity": classification.get("severity"),
        "risk_level": compliance.get("risk_level"),
        "risk_score": compliance.get("risk_score"),
        "assigned_team": routing.get("assigned_team") or enrichment["internal_teams"]["primary_team"]["team_name"],
        "priority": routing.get("priority") or enrichment["baseline"]["priority"],
        "submitted_at": detail.get("submitted_at"),
        "completed_at": detail.get("completed_at"),
        "narrative_preview": (complaint.get("narrative") or "")[:160] + ("..." if len(complaint.get("narrative") or "") > 160 else ""),
        "channel": complaint.get("channel", "web"),
        "customer_state": complaint.get("customer_state"),
        "tags": tags,
        "vulnerable_tags": vulnerable_tags,
        "processing_time_ms": detail.get("total_processing_time_ms"),
        "criticality_score": enrichment["criticality"]["score"],
        "criticality_level": enrichment["criticality"]["level"],
        "needs_human_review": enrichment["review_gate"]["needs_human_review"],
        "review_reason_codes": enrichment["review_gate"]["review_reason_codes"],
        "sla_breach_risk": enrichment["review_gate"]["sla_breach_risk"],
        "source": enrichment["source_metadata"]["source"],
        "source_label": enrichment["source_metadata"]["source_label"],
        "baseline_delta": enrichment["baseline"]["comparison"],
        "latest_review_decision": detail.get("latest_review_decision"),
        "customer_id": enrichment["customer_profile"]["customer_id"],
        "ticket_id": enrichment["ticket"]["ticket_id"],
    }


def enrich_detail(detail: Dict[str, Any]) -> Dict[str, Any]:
    return {**detail, **build_detail_enrichment(detail)}


def build_dashboard_stats_from_details(details: List[Dict[str, Any]]) -> Dict[str, Any]:
    summaries = [build_summary_from_detail(detail) for detail in details]
    total = len(summaries)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    product_distribution = Counter(summary["product"] or "Unknown" for summary in summaries)
    severity_distribution = Counter(summary["severity"] or "Unknown" for summary in summaries)
    risk_distribution = Counter(summary["risk_level"] or "Unknown" for summary in summaries)
    team_distribution = Counter(summary["assigned_team"] or "Unassigned" for summary in summaries)
    source_breakdown = Counter(summary["source"] or "manual_analysis" for summary in summaries)

    avg_resolution = 0.0
    if summaries:
        durations = [summary["processing_time_ms"] for summary in summaries if summary.get("processing_time_ms")]
        avg_resolution = round(sum(durations) / len(durations) / 1000 / 3600, 2) if durations else 0.0

    return {
        "total_complaints": total,
        "complaints_today": sum(1 for summary in summaries if (summary.get("submitted_at") or "").startswith(today)),
        "avg_resolution_time_hrs": avg_resolution,
        "compliance_flags_caught": sum(len((detail.get("compliance_risk") or {}).get("flags") or []) for detail in details),
        "auto_resolution_rate": round((sum(1 for summary in summaries if not summary["needs_human_review"]) / total * 100), 1) if total else 0.0,
        "critical_risk_count": sum(1 for summary in summaries if summary["risk_level"] == "CRITICAL"),
        "high_risk_count": sum(1 for summary in summaries if summary["risk_level"] == "HIGH"),
        "timely_response_rate": round((sum(1 for summary in summaries if not summary["sla_breach_risk"]) / total * 100), 1) if total else 0.0,
        "product_distribution": dict(product_distribution),
        "severity_distribution": dict(severity_distribution),
        "risk_distribution": dict(risk_distribution),
        "team_distribution": dict(team_distribution),
        "needs_human_review_count": sum(1 for summary in summaries if summary["needs_human_review"]),
        "high_regulatory_risk_count": sum(1 for summary in summaries if summary["risk_level"] in {"HIGH", "CRITICAL"}),
        "sla_breach_risk_count": sum(1 for summary in summaries if summary["sla_breach_risk"]),
        "source_breakdown": dict(source_breakdown),
    }


def build_dashboard_trends_from_details(details: List[Dict[str, Any]], limit_days: int = 14) -> Dict[str, Any]:
    cutoff = datetime.utcnow() - timedelta(days=max(limit_days - 1, 0))
    summaries = [build_summary_from_detail(detail) for detail in details]
    complaints_over_time = Counter()
    product_breakdown = Counter()
    severity_breakdown = Counter()
    risk_breakdown = Counter()
    team_breakdown = Counter()
    criticality_breakdown = Counter()
    baseline_breakdown = Counter({"aligned": 0, "divergent": 0})
    team_hours = defaultdict(list)

    for detail, summary in zip(details, summaries):
        submitted_at = detail.get("submitted_at")
        if submitted_at:
          try:
              dt = datetime.fromisoformat(submitted_at)
              if dt >= cutoff:
                  complaints_over_time[dt.strftime("%Y-%m-%d")] += 1
          except ValueError:
              pass
        product_breakdown[summary["product"] or "Unknown"] += 1
        severity_breakdown[summary["severity"] or "Unknown"] += 1
        risk_breakdown[summary["risk_level"] or "Unknown"] += 1
        team_breakdown[summary["assigned_team"] or "Unassigned"] += 1
        criticality_breakdown[summary["criticality_level"] or "Unknown"] += 1
        if (summary.get("baseline_delta") or {}).get("divergence_score", 0) >= 2:
            baseline_breakdown["divergent"] += 1
        else:
            baseline_breakdown["aligned"] += 1
        if summary.get("processing_time_ms"):
            team_hours[summary["product"] or "Unknown"].append(summary["processing_time_ms"] / 1000 / 3600)

    return {
        "complaints_over_time": [{"date": key, "count": complaints_over_time[key]} for key in sorted(complaints_over_time)],
        "product_breakdown": [{"name": name, "value": value} for name, value in product_breakdown.most_common(10)],
        "severity_breakdown": [{"name": name, "value": value} for name, value in severity_breakdown.items()],
        "risk_breakdown": [{"name": name, "value": value} for name, value in risk_breakdown.items()],
        "team_breakdown": [{"name": name, "value": value} for name, value in team_breakdown.most_common(10)],
        "risk_heatmap": [],
        "resolution_time_by_product": [
            {"product": product, "hours": round(sum(hours) / len(hours), 2)} for product, hours in team_hours.items() if hours
        ],
        "criticality_breakdown": [{"name": name, "value": value} for name, value in criticality_breakdown.items()],
        "baseline_divergence_breakdown": [{"name": name, "value": value} for name, value in baseline_breakdown.items()],
    }


def build_supervisor_snapshot_from_summaries(summaries: List[Dict[str, Any]], queue_limit: int = 6) -> Dict[str, Any]:
    needs_review = sorted(
        [item for item in summaries if item["needs_human_review"]],
        key=lambda item: (-(item.get("criticality_score") or 0), -(item.get("risk_score") or 0)),
    )
    high_risk = sorted(
        [item for item in summaries if item["risk_level"] in {"HIGH", "CRITICAL"}],
        key=lambda item: (-(item.get("risk_score") or 0), -(item.get("criticality_score") or 0)),
    )
    sla_risk = sorted(
        [item for item in summaries if item["sla_breach_risk"]],
        key=lambda item: (-(item.get("criticality_score") or 0), item.get("submitted_at") or ""),
    )
    return {
        "counts": {
            "needs_human_review": len(needs_review),
            "high_regulatory_risk": len(high_risk),
            "sla_breach_risk": len(sla_risk),
            "vulnerable_customer_cases": sum(1 for item in summaries if item.get("vulnerable_tags")),
        },
        "queues": {
            "needs_human_review": needs_review[:queue_limit],
            "high_regulatory_risk": high_risk[:queue_limit],
            "sla_breach_risk": sla_risk[:queue_limit],
        },
    }


def build_internal_team_metrics(details: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    summaries = [build_summary_from_detail(detail) for detail in details]
    detail_by_id = {detail["complaint_id"]: enrich_detail(detail) for detail in details}
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for summary in summaries:
        grouped[summary["assigned_team"] or "Unassigned"].append(summary)

    rows: List[Dict[str, Any]] = []
    for team in TEAM_CATALOG:
        members = grouped.get(team["name"], [])
        avg_score = round(sum((member.get("criticality_score") or 0) for member in members) / len(members), 1) if members else 0.0
        avg_credit = 0.0
        if members:
            avg_credit = round(sum(detail_by_id[member["complaint_id"]]["customer_profile"]["credit_score"] for member in members) / len(members), 0)
        rows.append({
            **team,
            "complaint_count": len(members),
            "high_risk_count": sum(1 for member in members if member["risk_level"] in {"HIGH", "CRITICAL"}),
            "needs_review_count": sum(1 for member in members if member["needs_human_review"]),
            "avg_criticality": avg_score,
            "avg_credit_score": avg_credit,
            "sample_complaints": members[:4],
        })
    rows.sort(key=lambda row: (-row["complaint_count"], row["name"]))
    return rows
