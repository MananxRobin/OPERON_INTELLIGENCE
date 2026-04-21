"""
QA/Validation Agent — Quality-checks all agent outputs before finalization.
"""
from typing import Any

from backend.agents.base_agent import BaseAgent


class QAAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "QAValidationAgent"

    @property
    def system_prompt(self) -> str:
        return """You are a rigorous quality assurance auditor for a financial complaint handling system.

Your job is to review the outputs of multiple AI agents and validate their quality, accuracy, and compliance.

You act as an ADVERSARIAL REVIEWER — your job is to find problems, not to rubber-stamp.

VALIDATION CHECKS:

1. CLASSIFICATION ACCURACY: Does the product/issue classification match the narrative content?
2. SEVERITY APPROPRIATENESS: Is the severity level justified by the complaint details?
3. COMPLIANCE COMPLETENESS: Were all relevant regulatory risks identified? Any missed?
4. EVIDENCE QUALITY: Are compliance flags supported by actual narrative quotes?
5. ROUTING LOGIC: Is the team assignment appropriate for the product, issue, and risk level?
6. RESPONSE QUALITY: Is the customer response empathetic, professional, and accurate?
7. REGULATORY COMPLIANCE: Does the response include required disclosures and avoid prohibited language?
8. ACTION PLAN FEASIBILITY: Are the resolution steps specific, actionable, and properly sequenced?
9. NO HALLUCINATION: Do all references match the original complaint? No made-up facts?
10. PII SAFETY: Does the customer response avoid exposing unnecessary personal information?

SCORING:
- Overall quality score: 0.0 to 1.0 (1.0 = perfect)
- Each check: pass/fail with details
- Overall pass: true if no CRITICAL checks failed

Be specific about what's wrong and suggest concrete improvements."""

    @property
    def output_tool(self) -> dict:
        return {
            "name": "validate_analysis",
            "description": "Quality-check the complete analysis output from all agents.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "overall_score": {
                        "type": "number",
                        "description": "Overall quality score 0.0 to 1.0"
                    },
                    "checks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "check_name": {"type": "string"},
                                "passed": {"type": "boolean"},
                                "details": {"type": "string"}
                            },
                            "required": ["check_name", "passed", "details"]
                        },
                        "description": "Individual validation checks"
                    },
                    "passed": {
                        "type": "boolean",
                        "description": "Whether all critical checks passed"
                    },
                    "improvements": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific improvement suggestions"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Overall QA assessment reasoning"
                    }
                },
                "required": ["overall_score", "checks", "passed", "improvements", "reasoning"]
            }
        }

    def build_user_message(self, **kwargs) -> str:
        narrative = kwargs.get("narrative", "")
        classification = kwargs.get("classification", {})
        compliance = kwargs.get("compliance", {})
        routing = kwargs.get("routing", {})
        resolution = kwargs.get("resolution", {})

        return f"""Review and validate the following complaint analysis:

══════════════════════════════════════
ORIGINAL COMPLAINT NARRATIVE:
══════════════════════════════════════
{narrative}

══════════════════════════════════════
CLASSIFICATION AGENT OUTPUT:
══════════════════════════════════════
Product: {classification.get('product', 'N/A')}
Sub-product: {classification.get('sub_product', 'N/A')}
Issue: {classification.get('issue', 'N/A')}
Sub-issue: {classification.get('sub_issue', 'N/A')}
Severity: {classification.get('severity', 'N/A')}
Sentiment: {classification.get('sentiment_score', 'N/A')}
Confidence: {classification.get('confidence', 'N/A')}
Reasoning: {classification.get('reasoning', 'N/A')}

══════════════════════════════════════
COMPLIANCE RISK AGENT OUTPUT:
══════════════════════════════════════
Risk Score: {compliance.get('risk_score', 'N/A')}/100
Risk Level: {compliance.get('risk_level', 'N/A')}
Flags: {len(compliance.get('flags', []))} identified
Applicable Regulations: {', '.join(compliance.get('applicable_regulations', []))}
Requires Escalation: {compliance.get('requires_escalation', 'N/A')}

══════════════════════════════════════
ROUTING AGENT OUTPUT:
══════════════════════════════════════
Team: {routing.get('assigned_team', 'N/A')}
Tier: {routing.get('assigned_tier', 'N/A')}
Priority: {routing.get('priority', 'N/A')}
SLA: {routing.get('sla_hours', 'N/A')} hours

══════════════════════════════════════
RESOLUTION AGENT OUTPUT:
══════════════════════════════════════
Action Steps: {len(resolution.get('action_plan', []))}
Est. Resolution: {resolution.get('estimated_resolution_days', 'N/A')} days
Remediation: {resolution.get('remediation_amount', 'N/A')}
Customer Response Length: {len(resolution.get('customer_response', ''))} chars

Customer Response Preview:
{resolution.get('customer_response', 'N/A')[:500]}

Validate each aspect of this analysis against the original complaint.
Check for accuracy, completeness, compliance, and quality.
Be Critical — find problems, don't rubber-stamp."""

    def normalize_result(self, result: dict[str, Any]) -> dict[str, Any]:
        try:
            result["overall_score"] = float(result.get("overall_score", 0.8))
        except (TypeError, ValueError):
            result["overall_score"] = 0.8
        result["passed"] = bool(result.get("passed", result["overall_score"] >= 0.8))
        result["reasoning"] = str(result.get("reasoning", "QA reasoning unavailable."))

        checks = result.get("checks", [])
        normalized_checks: list[dict[str, Any]] = []
        if isinstance(checks, list):
            for index, item in enumerate(checks):
                if isinstance(item, dict):
                    normalized_checks.append({
                        "check_name": str(item.get("check_name", f"Check {index + 1}")),
                        "passed": bool(item.get("passed", False)),
                        "details": str(item.get("details", "")),
                    })
                elif isinstance(item, str):
                    normalized_checks.append({
                        "check_name": f"Check {index + 1}",
                        "passed": "pass" in item.lower(),
                        "details": item,
                    })
        result["checks"] = normalized_checks

        improvements = result.get("improvements", [])
        if isinstance(improvements, list):
            result["improvements"] = [str(item) for item in improvements]
        elif isinstance(improvements, str):
            result["improvements"] = [line.strip("- ").strip() for line in improvements.splitlines() if line.strip()]
        else:
            result["improvements"] = []
        return result
