"""Deterministic local complaint-analysis pipeline for demos and offline use."""

from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List


REGULATION_LIBRARY: Dict[str, Dict[str, str]] = {
    "TILA": {
        "regulation": "TILA",
        "regulation_name": "Truth in Lending Act / Regulation Z",
        "description": "Disclosure, APR, fee, and billing-rights exposure.",
    },
    "REGE": {
        "regulation": "REGE",
        "regulation_name": "Electronic Fund Transfer Act / Regulation E",
        "description": "Electronic transfer error-resolution or unauthorized-transfer exposure.",
    },
    "FCRA": {
        "regulation": "FCRA",
        "regulation_name": "Fair Credit Reporting Act",
        "description": "Credit reporting accuracy, furnishing, or dispute exposure.",
    },
    "ECOA": {
        "regulation": "ECOA",
        "regulation_name": "Equal Credit Opportunity Act / Regulation B",
        "description": "Fair lending or adverse-action risk.",
    },
    "FDCPA": {
        "regulation": "FDCPA",
        "regulation_name": "Fair Debt Collection Practices Act",
        "description": "Debt collection conduct and consumer-communication exposure.",
    },
    "RESPA": {
        "regulation": "RESPA",
        "regulation_name": "Real Estate Settlement Procedures Act / Regulation X",
        "description": "Mortgage servicing, escrow, loss mitigation, or payoff exposure.",
    },
    "SCRA": {
        "regulation": "SCRA",
        "regulation_name": "Servicemembers Civil Relief Act",
        "description": "Military-rate relief and servicemember protections exposure.",
    },
    "UDAAP": {
        "regulation": "UDAAP",
        "regulation_name": "Unfair, Deceptive, or Abusive Acts or Practices",
        "description": "Deceptive, abusive, or unfair servicing and disclosure patterns.",
    },
}

PRODUCT_RULES = [
    ("Credit card", ["credit card", "cardholder", "apr", "limit increase", "annual fee", "rewards points"]),
    ("Checking account", ["checking", "wire transfer", "mobile check", "overdraft", "zelle", "peer-to-peer"]),
    ("Savings account", ["savings account", "high-yield savings", "apy", "savings"]),
    ("Mortgage", ["mortgage", "foreclosure", "escrow", "servicer", "lien release", "loss mitigation", "home closing"]),
    ("Student loan", ["student loan", "student loans", "teacher", "pslf", "deferment"]),
    ("Vehicle loan", ["auto loan", "vehicle loan", "repossession", "car loan"]),
    ("Business loan", ["business loan", "small business"]),
    ("Home equity loan", ["home equity", "secured loan"]),
    ("Personal loan", ["personal loan", "origination fee", "installment loan", "online lender"]),
    ("Debt collection", ["collections", "collector", "debt", "harassment", "validation notice"]),
]

ISSUE_RULES = [
    ("Unauthorized transactions and fraud handling", ["unauthorized", "stolen", "fraud", "hacked", "account takeover"]),
    ("APR, fees, and disclosure mismatch", ["apr", "interest rate", "origination fee", "fee", "annual fee", "promotion", "deceptive"]),
    ("Billing dispute and duplicate charge", ["duplicate charge", "double-charg", "chargeback", "dispute", "merchant dispute"]),
    ("Credit reporting and furnishing error", ["credit report", "credit bureau", "credit score", "reported late", "delinquency"]),
    ("Mortgage servicing and escrow breakdown", ["escrow", "mortgage", "loss mitigation", "foreclosure", "lien release", "misapplying"]),
    ("Collections conduct and debt validation", ["collections", "collector", "harass", "calling me", "validation"]),
    ("Authentication and account access failure", ["locked out", "password reset", "verification code", "login", "authentication"]),
    ("Payments, transfers, and funds availability", ["wire transfer", "mobile check", "transfer", "deposit", "funds", "overdraft"]),
    ("Fair lending or discrimination risk", ["discrimin", "redlining", "minority", "fair lending"]),
]


def _excerpt(text: str, markers: List[str]) -> str:
    lowered = text.lower()
    for marker in markers:
        index = lowered.find(marker.lower())
        if index == -1:
            continue
        start = max(0, index - 24)
        end = min(len(text), index + len(marker) + 42)
        return text[start:end].strip()
    words = text.split()
    return " ".join(words[:20]).strip()


def _amounts(text: str) -> List[str]:
    return re.findall(r"\$\s?\d[\d,]*(?:\.\d{2})?", text or "")


def _risk_level(score: int) -> str:
    if score >= 78:
        return "CRITICAL"
    if score >= 58:
        return "HIGH"
    if score >= 36:
        return "MEDIUM"
    return "LOW"


def classify_complaint(narrative: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    text = narrative or ""
    lowered = text.lower()
    product = metadata.get("product")
    matched_product = product

    if not matched_product:
        for candidate, markers in PRODUCT_RULES:
            if any(marker in lowered for marker in markers):
                matched_product = candidate
                break
    matched_product = matched_product or "Checking account"

    issue = "Service handling and complaint response"
    issue_markers: List[str] = []
    for candidate, markers in ISSUE_RULES:
        if any(marker in lowered for marker in markers):
            issue = candidate
            issue_markers = markers
            break

    amount_markers = _amounts(text)
    urgency_points = 0
    if any(marker in lowered for marker in ["immediately", "eviction", "foreclosure", "repossession", "police report"]):
        urgency_points += 2
    if any(marker in lowered for marker in ["unauthorized", "fraud", "stolen", "discrimin", "dual tracking"]):
        urgency_points += 2
    if amount_markers:
        urgency_points += 1
        if any(float(value.replace("$", "").replace(",", "").strip()) >= 5000 for value in amount_markers):
            urgency_points += 1
    if any(str(tag).lower() in {"older american", "servicemember"} for tag in metadata.get("tags", []) or []):
        urgency_points += 1

    severity = "LOW"
    if urgency_points >= 5:
        severity = "CRITICAL"
    elif urgency_points >= 3:
        severity = "HIGH"
    elif urgency_points >= 1:
        severity = "MEDIUM"

    confidence = min(0.95, 0.72 + (0.04 if product else 0) + (0.05 if issue_markers else 0) + (0.03 if amount_markers else 0))
    key_entities = amount_markers[:3]
    if not key_entities and issue_markers:
        key_entities = [marker for marker in issue_markers[:2] if marker in lowered]
    urgency = {
        "CRITICAL": "Immediate",
        "HIGH": "High",
        "MEDIUM": "Moderate",
        "LOW": "Routine",
    }[severity]

    return {
        "product": matched_product,
        "sub_product": matched_product,
        "issue": issue,
        "sub_issue": issue,
        "severity": severity,
        "sentiment_score": -0.68 if severity in {"CRITICAL", "HIGH"} else -0.34,
        "urgency": urgency,
        "confidence": round(confidence, 2),
        "key_entities": key_entities,
        "reasoning": f"Complaint classified as {matched_product} based on narrative product cues and issue signals around {issue.lower()}.",
    }


def assess_compliance(narrative: str, classification: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    text = narrative or ""
    lowered = text.lower()
    flags: List[Dict[str, Any]] = []

    def add_flag(code: str, markers: List[str], severity: str):
        if any(marker in lowered for marker in markers):
            library = REGULATION_LIBRARY[code]
            flags.append({
                **library,
                "evidence_quote": _excerpt(text, markers),
                "severity": severity,
            })

    add_flag("REGE", ["unauthorized", "wire transfer", "transfer", "mobile app", "zelle", "debit"], "HIGH")
    add_flag("TILA", ["apr", "interest rate", "origination fee", "annual fee", "billing", "statement"], "HIGH")
    add_flag("FCRA", ["credit report", "credit score", "reported late", "credit bureau"], "HIGH")
    add_flag("ECOA", ["discrimin", "redlining", "minority", "adverse action"], "CRITICAL")
    add_flag("FDCPA", ["collections", "collector", "calling me", "harass", "validation"], "CRITICAL")
    add_flag("RESPA", ["mortgage", "escrow", "loss mitigation", "foreclosure", "lien release", "servicer"], "CRITICAL")
    add_flag("SCRA", ["servicemember", "military orders", "scra"], "CRITICAL")
    add_flag("UDAAP", ["deceptive", "misled", "unfair", "aggressive", "hidden fees"], "HIGH")

    applicable = sorted({flag["regulation"] for flag in flags})
    severity = classification.get("severity") or "LOW"
    score = {"LOW": 22, "MEDIUM": 42, "HIGH": 66, "CRITICAL": 82}.get(severity, 42)
    score += min(18, len(flags) * 6)
    if metadata.get("channel") == "cfpb":
        score += 6
    if any(str(tag).lower() in {"older american", "servicemember"} for tag in metadata.get("tags", []) or []):
        score += 6
    if any(marker in lowered for marker in ["eviction", "foreclosure", "repossession", "medical emergency", "fixed income"]):
        score += 6
    score = max(10, min(98, score))
    risk_level = _risk_level(score)

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "flags": flags,
        "applicable_regulations": applicable,
        "requires_escalation": risk_level in {"HIGH", "CRITICAL"},
        "reasoning": f"Compliance risk is {risk_level.lower()} because the narrative contains {len(flags)} regulatory flags and severity is {severity.lower()}.",
    }


def route_complaint(
    narrative: str,
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    lowered = (narrative or "").lower()
    product = (classification.get("product") or "").lower()
    issue = (classification.get("issue") or "").lower()
    risk_score = int(compliance.get("risk_score") or 40)

    assigned_team = "Retail Banking Operations Team"
    because = "Deposit and servicing cases default to retail banking operations."

    if metadata.get("channel") == "cfpb" and risk_score >= 84:
        assigned_team = "Executive Response Team"
        because = "A regulator-originated high-severity complaint requires executive-response ownership."
    elif "fraud" in issue or any(marker in lowered for marker in ["unauthorized", "hacked", "stolen"]):
        assigned_team = "Fraud Investigation Team"
        because = "Unauthorized-access and fraud indicators route the case to fraud investigation."
    elif any(marker in lowered for marker in ["locked out", "password reset", "verification code", "authentication"]):
        assigned_team = "Identity & Access Support Team"
        because = "Authentication and access signals route the complaint to identity support."
    elif "credit card" in product and any(marker in issue for marker in ["billing dispute", "duplicate charge", "fraud"]):
        assigned_team = "Card Disputes Team"
        because = "Card-dispute markers require the specialized disputes queue."
    elif "credit card" in product:
        assigned_team = "Card Operations Team"
        because = "Card servicing and fee/APR issues route to card operations."
    elif "mortgage" in product or "home equity" in product:
        assigned_team = "Mortgage Servicing Team"
        because = "Mortgage servicing, escrow, and payoff issues route to mortgage servicing."
    elif "student loan" in product:
        assigned_team = "Student Lending Team"
        because = "Student-loan servicing and repayment issues route to student lending."
    elif "loan" in product:
        assigned_team = "Lending Operations Team"
        because = "Consumer-lending issues route to lending operations."
    elif "debt collection" in product or "collections" in issue:
        assigned_team = "Collections Compliance Team"
        because = "Collection-conduct exposure routes the case to collections compliance."
    elif any(marker in lowered for marker in ["app crashed", "mobile app", "chatbot", "website"]):
        assigned_team = "Digital Experience Team"
        because = "Digital-channel failure indicators route the complaint to digital experience."

    if risk_score >= 90:
        priority = "P1_IMMEDIATE"
    elif risk_score >= 72:
        priority = "P2_HIGH"
    elif risk_score >= 48:
        priority = "P3_MEDIUM"
    else:
        priority = "P4_LOW"

    assigned_tier = {
        "P1_IMMEDIATE": "Executive",
        "P2_HIGH": "Manager",
        "P3_MEDIUM": "Senior",
        "P4_LOW": "Analyst",
    }[priority]
    sla_hours = {
        "P1_IMMEDIATE": 4,
        "P2_HIGH": 24,
        "P3_MEDIUM": 48,
        "P4_LOW": 72,
    }[priority]

    escalation_path = [assigned_team]
    if compliance.get("risk_level") in {"HIGH", "CRITICAL"} and assigned_team != "Regulatory Compliance Team":
        escalation_path.append("Regulatory Compliance Team")
    if any(str(tag).lower() in {"older american", "servicemember"} for tag in metadata.get("tags", []) or []):
        escalation_path.append("Vulnerable Customer Care Team")
    if priority == "P1_IMMEDIATE":
        escalation_path.append("Executive Response Team")

    return {
        "assigned_team": assigned_team,
        "assigned_tier": assigned_tier,
        "priority": priority,
        "sla_hours": sla_hours,
        "escalation_path": escalation_path,
        "requires_immediate_attention": priority == "P1_IMMEDIATE",
        "reasoning": f"Routing balanced product specialization, issue markers, and a {compliance.get('risk_level', 'MEDIUM').lower()} compliance profile.",
        "because": because,
    }


def build_resolution(
    narrative: str,
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    routing: Dict[str, Any],
) -> Dict[str, Any]:
    days = {
        "P1_IMMEDIATE": 1,
        "P2_HIGH": 3,
        "P3_MEDIUM": 5,
        "P4_LOW": 7,
    }[routing.get("priority", "P3_MEDIUM")]

    actions = [
        f"Open a {routing.get('assigned_team')} work item with {routing.get('priority')} priority.",
        "Validate the consumer timeline, account activity, and prior servicing interactions.",
        "Confirm applicable regulations and document any required remediation or fee reversal.",
        "Send a compliant customer update with next steps and expected resolution timing.",
    ]
    if compliance.get("risk_level") in {"HIGH", "CRITICAL"}:
        actions.insert(1, "Escalate the complaint into compliance review and preserve all servicing artifacts.")

    remediation_amount = _amounts(narrative)

    return {
        "action_plan": actions,
        "customer_response": (
            "We have reviewed your complaint and opened an accelerated investigation. "
            "A specialist team is validating the account history, any disputed activity, "
            "and the remediation required to resolve this matter."
        ),
        "internal_notes": (
            f"Primary owner: {routing.get('assigned_team')}. "
            f"Compliance posture: {compliance.get('risk_level')}. "
            f"Focus on the complaint narrative and any referenced transactions or disclosures."
        ),
        "preventive_recommendations": [
            "Refresh routing rules for similar complaint signatures.",
            "Add explainability snippets into supervisor review queues.",
            "Track repeat-product patterns for upstream control remediation.",
        ],
        "estimated_resolution_days": days,
        "remediation_amount": remediation_amount[0] if remediation_amount else None,
        "reasoning": "Resolution package prioritizes consumer-impact containment, regulatory defensibility, and team-ready next actions.",
    }


def build_qa(
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    routing: Dict[str, Any],
) -> Dict[str, Any]:
    confidence = float(classification.get("confidence") or 0.8)
    flag_count = len(compliance.get("flags") or [])
    score = min(0.97, max(0.71, confidence + (0.03 if routing.get("because") else 0.0) - (0.02 if flag_count >= 4 else 0.0)))
    passed = score >= 0.79 and not (compliance.get("risk_level") == "CRITICAL" and confidence < 0.8)

    checks = [
        {"check_name": "Classification confidence", "passed": confidence >= 0.78, "details": f"Confidence at {round(confidence * 100)}%."},
        {"check_name": "Routing rationale", "passed": bool(routing.get("because")), "details": "Short why-routed explanation is present."},
        {"check_name": "Compliance coverage", "passed": flag_count > 0, "details": f"{flag_count} compliance flags were captured."},
    ]

    improvements = []
    if confidence < 0.8:
        improvements.append("Add a more explicit issue summary or channel context to improve classifier certainty.")
    if flag_count == 0:
        improvements.append("Review the narrative for additional policy or regulatory triggers.")
    if compliance.get("risk_level") == "CRITICAL":
        improvements.append("Route through supervisor review before final customer response.")

    return {
        "overall_score": round(score, 2),
        "checks": checks,
        "passed": passed,
        "improvements": improvements,
        "reasoning": "QA validates classifier certainty, routing explainability, and compliance coverage before final disposition.",
    }


def build_audit_entries(
    complaint_id: str,
    narrative: str,
    classification: Dict[str, Any],
    compliance: Dict[str, Any],
    routing: Dict[str, Any],
    resolution: Dict[str, Any],
    qa: Dict[str, Any],
) -> List[Dict[str, Any]]:
    excerpts = _amounts(narrative)[:2] or [narrative[:72].strip()]
    now = datetime.utcnow().isoformat()
    return [
        {
            "agent_name": "ClassificationAgent",
            "timestamp": now,
            "decision": f"{classification['product']} → {classification['issue']}",
            "confidence": classification.get("confidence"),
            "reasoning": classification.get("reasoning"),
            "evidence_spans": excerpts,
            "input_summary": "Complaint narrative and intake metadata.",
            "output_summary": f"Severity {classification['severity']} with urgency {classification['urgency']}.",
            "duration_ms": 84,
        },
        {
            "agent_name": "ComplianceRiskAgent",
            "timestamp": now,
            "decision": f"Risk {compliance['risk_level']} ({compliance['risk_score']})",
            "confidence": 0.88,
            "reasoning": compliance.get("reasoning"),
            "evidence_spans": [flag.get("evidence_quote") for flag in compliance.get("flags", [])[:3] if flag.get("evidence_quote")],
            "input_summary": "Classification output plus original complaint narrative.",
            "output_summary": f"{len(compliance.get('flags', []))} compliance flags and regulations {', '.join(compliance.get('applicable_regulations', [])) or 'none'}.",
            "duration_ms": 72,
        },
        {
            "agent_name": "RoutingAgent",
            "timestamp": now,
            "decision": f"Assigned to {routing['assigned_team']}",
            "confidence": 0.9,
            "reasoning": routing.get("reasoning"),
            "evidence_spans": [routing.get("because")] if routing.get("because") else [],
            "input_summary": "Product, issue, risk score, and intake channel.",
            "output_summary": f"{routing['priority']} with {routing['sla_hours']}h SLA.",
            "duration_ms": 65,
        },
        {
            "agent_name": "ResolutionAgent",
            "timestamp": now,
            "decision": "Resolution plan drafted",
            "confidence": 0.86,
            "reasoning": resolution.get("reasoning"),
            "evidence_spans": excerpts[:1],
            "input_summary": "Routing decision plus compliance posture.",
            "output_summary": f"{len(resolution.get('action_plan', []))} actions with {resolution.get('estimated_resolution_days')} day estimate.",
            "duration_ms": 59,
        },
        {
            "agent_name": "QAValidationAgent",
            "timestamp": now,
            "decision": "Passed" if qa.get("passed") else "Needs Human Review",
            "confidence": qa.get("overall_score"),
            "reasoning": qa.get("reasoning"),
            "evidence_spans": qa.get("improvements", [])[:2],
            "input_summary": "Classification, compliance, routing, and resolution outputs.",
            "output_summary": f"QA score {round((qa.get('overall_score') or 0) * 100)}%.",
            "duration_ms": 43,
        },
    ]


def run_local_pipeline(complaint_id: str, narrative: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    submitted_at = datetime.utcnow().isoformat()
    classification = classify_complaint(narrative, metadata)
    compliance = assess_compliance(narrative, classification, metadata)
    routing = route_complaint(narrative, classification, compliance, metadata)
    resolution = build_resolution(narrative, classification, compliance, routing)
    qa = build_qa(classification, compliance, routing)
    audit_trail = build_audit_entries(complaint_id, narrative, classification, compliance, routing, resolution, qa)

    return {
        "complaint_id": complaint_id,
        "status": "analyzed",
        "submitted_at": submitted_at,
        "completed_at": datetime.utcnow().isoformat(),
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
        "total_processing_time_ms": sum(entry.get("duration_ms", 0) for entry in audit_trail),
    }
