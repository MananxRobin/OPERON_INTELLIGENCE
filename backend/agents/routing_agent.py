"""
Routing Agent — Assigns complaints to appropriate internal teams with priority.
"""
from backend.agents.base_agent import BaseAgent


class RoutingAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "RoutingAgent"

    @property
    def system_prompt(self) -> str:
        return """You are an intelligent complaint routing agent for a national fintech company.

Your job is to assign complaints to the right internal team based on classification and compliance risk data.

AVAILABLE TEAMS:
1. Credit Card Disputes Team — Handles credit card billing disputes, chargebacks, and fraud claims
2. Credit Card Operations Team — Handles card features, limits, fees, rewards, and account management
3. Lending Operations Team — Handles personal loans, auto loans, student loan servicing
4. Mortgage Servicing Team — Handles mortgage payments, escrow, modifications, and payoff
5. Digital Banking Support Team — Handles app issues, account access, transfers, and online banking
6. Debt Collection Compliance Team — Handles debt collection complaints and FDCPA issues
7. Legal & Compliance Team — Handles high-risk regulatory matters, potential violations, and litigation
8. Fraud Investigation Team — Handles fraud, identity theft, and unauthorized access
9. Customer Retention Team — Handles escalated service failures and at-risk customers
10. Executive Response Team — Handles CFPB complaints, attorney general complaints, and media inquiries

AGENT TIERS:
- Junior: Routine, low-severity complaints with clear resolution paths
- Senior: Complex complaints requiring investigation, moderate risk
- Manager: High-severity complaints, compliance escalations, repeated failures
- Legal: Any complaint with CRITICAL compliance risk or litigation threat

PRIORITY LEVELS:
- P1_IMMEDIATE: CRITICAL risk, active financial harm, regulatory deadline imminent
- P2_HIGH: HIGH risk, significant customer impact, SLA at risk
- P3_MEDIUM: Standard complaint, routine investigation needed
- P4_LOW: Minor issue, informational, low urgency

SLA GUIDELINES (hours to first response):
- P1: 4 hours
- P2: 24 hours
- P3: 48 hours
- P4: 72 hours

ESCALATION RULES:
- Compliance risk ≥ 76 → ALWAYS route to Legal & Compliance
- CFPB channel complaints → Executive Response Team involvement
- Elder abuse indicators → Immediate manager + compliance escalation
- Servicemember issues → Priority handling + SCRA specialist
- Repeated complaints (3+ from same customer) → Customer Retention + Manager

Provide clear reasoning for your routing decision."""

    @property
    def output_tool(self) -> dict:
        return {
            "name": "route_complaint",
            "description": "Route a complaint to the appropriate internal team.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "assigned_team": {
                        "type": "string",
                        "description": "Primary team to handle the complaint"
                    },
                    "assigned_tier": {
                        "type": "string",
                        "enum": ["Junior", "Senior", "Manager", "Legal"],
                        "description": "Agent tier assignment"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["P1_IMMEDIATE", "P2_HIGH", "P3_MEDIUM", "P4_LOW"],
                        "description": "Priority level"
                    },
                    "sla_hours": {
                        "type": "integer",
                        "description": "SLA deadline in hours"
                    },
                    "escalation_path": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Escalation chain if primary team cannot resolve"
                    },
                    "requires_immediate_attention": {
                        "type": "boolean",
                        "description": "Whether this needs immediate human attention"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Routing reasoning"
                    }
                },
                "required": ["assigned_team", "assigned_tier", "priority",
                            "sla_hours", "escalation_path",
                            "requires_immediate_attention", "reasoning"]
            }
        }

    def build_user_message(self, **kwargs) -> str:
        narrative = kwargs.get("narrative", "")
        classification = kwargs.get("classification", {})
        compliance = kwargs.get("compliance", {})
        metadata = kwargs.get("metadata", {})

        flags_summary = ""
        if compliance.get("flags"):
            flags_summary = "\nCompliance Flags:\n"
            for f in compliance["flags"]:
                flags_summary += f"  - {f.get('regulation', 'N/A')}: {f.get('description', 'N/A')} (Severity: {f.get('severity', 'N/A')})\n"

        return f"""Route the following complaint to the appropriate internal team:

COMPLAINT NARRATIVE (summary):
{narrative[:1000]}

CLASSIFICATION:
- Product: {classification.get('product', 'Unknown')}
- Issue: {classification.get('issue', 'Unknown')}
- Severity: {classification.get('severity', 'Unknown')}
- Urgency: {classification.get('urgency', 'Unknown')}

COMPLIANCE RISK:
- Risk Score: {compliance.get('risk_score', 'N/A')}/100
- Risk Level: {compliance.get('risk_level', 'Unknown')}
- Requires Escalation: {compliance.get('requires_escalation', False)}{flags_summary}

METADATA:
- Channel: {metadata.get('channel', 'Unknown')}
- Customer State: {metadata.get('customer_state', 'Unknown')}
- Tags: {', '.join(metadata.get('tags', [])) or 'None'}

Determine the best team, agent tier, priority level, and SLA.
Provide an escalation path if needed."""
