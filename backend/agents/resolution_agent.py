"""
Resolution Agent — Generates complete resolution plans, customer responses, and prevention recommendations.
"""
from backend.agents.base_agent import BaseAgent


class ResolutionAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "ResolutionAgent"

    @property
    def system_prompt(self) -> str:
        return """You are an expert complaint resolution agent for a national fintech company.

Your job is to generate comprehensive resolution plans that include:
1. A step-by-step internal action plan with specific timelines
2. A professional, empathetic, regulatory-compliant customer response letter
3. Preventive recommendations to stop the issue from recurring

RESOLUTION PRINCIPLES:
- Prioritize customer harm remediation — fix the problem first
- Include specific dollar amounts for remediation when applicable
- Reference applicable regulation requirements for timelines
- Customer response must be empathetic, professional, and non-adversarial
- Never admit regulatory violations in customer response, but acknowledge the issue
- Include required regulatory disclosures (dispute rights, escalation options)
- Preventive recommendations should address root causes, not symptoms

CUSTOMER RESPONSE GUIDELINES:
- Open with empathy: acknowledge the customer's experience
- Be specific: reference their exact complaint details
- Provide concrete next steps and timelines
- Include contact information for follow-up
- Mention regulatory rights (CFPB, state AG) where appropriate
- Close with commitment to improvement
- Keep it professional but warm — not corporate-speak

INTERNAL ACTION PLAN FORMAT:
Each step should include:
- Action description
- Responsible party
- Timeline (e.g., "Day 1", "Day 1-3", "Within 24 hours")
- Dependencies on other steps

REMEDIATION:
- Calculate and specify refund amounts where applicable
- Include interest on wrongly charged amounts  
- Consider goodwill credits for significant inconvenience
- Factor in regulatory requirements (e.g., Reg E provisional credits)

Provide estimated resolution time in business days."""

    @property
    def output_tool(self) -> dict:
        return {
            "name": "generate_resolution",
            "description": "Generate a complete resolution plan for a consumer complaint.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action_plan": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Ordered list of internal resolution steps with timelines"
                    },
                    "customer_response": {
                        "type": "string",
                        "description": "Professional, empathetic customer response letter"
                    },
                    "internal_notes": {
                        "type": "string",
                        "description": "Internal notes for the handling team"
                    },
                    "preventive_recommendations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Recommendations to prevent recurrence"
                    },
                    "estimated_resolution_days": {
                        "type": "integer",
                        "description": "Estimated business days to resolve"
                    },
                    "remediation_amount": {
                        "type": "string",
                        "description": "Estimated remediation/refund amount, or 'N/A'"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Resolution strategy reasoning"
                    }
                },
                "required": ["action_plan", "customer_response", "internal_notes",
                            "preventive_recommendations", "estimated_resolution_days",
                            "remediation_amount", "reasoning"]
            }
        }

    def build_user_message(self, **kwargs) -> str:
        narrative = kwargs.get("narrative", "")
        classification = kwargs.get("classification", {})
        compliance = kwargs.get("compliance", {})
        routing = kwargs.get("routing", {})

        flags_detail = ""
        if compliance.get("flags"):
            flags_detail = "\nRegulatory Flags:\n"
            for f in compliance["flags"]:
                flags_detail += f"  - {f.get('regulation', '')}: {f.get('description', '')}\n"

        return f"""Generate a complete resolution plan for the following complaint:

ORIGINAL COMPLAINT:
{narrative}

CLASSIFICATION:
- Product: {classification.get('product', 'Unknown')}
- Issue: {classification.get('issue', 'Unknown')}
- Sub-issue: {classification.get('sub_issue', 'Unknown')}
- Severity: {classification.get('severity', 'Unknown')}

COMPLIANCE ASSESSMENT:
- Risk Score: {compliance.get('risk_score', 'N/A')}/100
- Risk Level: {compliance.get('risk_level', 'Unknown')}
- Requires Escalation: {compliance.get('requires_escalation', False)}{flags_detail}

ROUTING:
- Assigned Team: {routing.get('assigned_team', 'Unknown')}
- Priority: {routing.get('priority', 'Unknown')}
- SLA: {routing.get('sla_hours', 'N/A')} hours

Generate:
1. A detailed internal action plan with numbered steps and timelines
2. A professional, empathetic customer response letter
3. Internal notes for the handling team
4. Preventive recommendations to stop this issue from recurring
5. An estimated remediation amount if applicable"""
