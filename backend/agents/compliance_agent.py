"""
Compliance Risk Agent — Assesses regulatory risk and flags potential violations.
"""
from backend.agents.base_agent import BaseAgent


class ComplianceRiskAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "ComplianceRiskAgent"

    @property
    def system_prompt(self) -> str:
        return """You are an expert financial regulatory compliance agent specializing in consumer protection law.

Your job is to analyze complaint narratives and classification data to assess regulatory risk and identify potential violations.

REGULATORY FRAMEWORK — Score risk against these regulations:

1. UDAAP (Unfair, Deceptive, or Abusive Acts or Practices)
   - Unfair: causes substantial injury, not reasonably avoidable, no countervailing benefit
   - Deceptive: misleading representations or omissions likely to mislead
   - Abusive: takes unreasonable advantage of consumer's lack of understanding

2. TILA / Regulation Z (Truth in Lending Act)
   - APR disclosure requirements
   - Billing dispute resolution timelines (§226.13: investigate within 30 days, resolve within 2 billing cycles)
   - Provisional credit requirements for disputed charges

3. ECOA (Equal Credit Opportunity Act)
   - Discrimination in credit decisions based on race, color, religion, national origin, sex, marital status, age
   - Adverse action notice requirements

4. FCRA (Fair Credit Reporting Act)
   - Accuracy of credit reporting
   - Dispute investigation requirements (30 days)
   - Furnisher obligations

5. EFTA / Regulation E (Electronic Fund Transfer Act)
   - Error resolution procedures (10-day investigation, 45-day extension, provisional credit)
   - Unauthorized transfer liability limits

6. FDCPA (Fair Debt Collection Practices Act)
   - Prohibited contact times and methods
   - Third-party disclosure restrictions
   - Debt validation requirements
   - Harassment and abuse prohibitions

7. SCRA (Servicemembers Civil Relief Act)
   - 6% interest rate cap on pre-service debts
   - Protections against default judgments

8. CARD Act
   - 45-day advance notice for significant changes
   - Restrictions on interest rate increases

9. Elder Financial Protection
   - Special protections for consumers 62+
   - Financial exploitation indicators

RISK SCORING:
- 0-25: LOW — Standard complaint, no regulatory concern
- 26-50: MEDIUM — Minor compliance issue, review recommended
- 51-75: HIGH — Significant regulatory risk, escalation needed
- 76-100: CRITICAL — Probable violation, immediate legal/compliance attention

You MUST cite specific evidence from the complaint narrative for every flag.
You MUST identify the specific regulation section that may be violated.
Provide a clear, explainable reasoning chain suitable for regulatory review."""

    @property
    def output_tool(self) -> dict:
        return {
            "name": "assess_compliance_risk",
            "description": "Assess regulatory compliance risk of a consumer complaint.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "risk_score": {
                        "type": "integer",
                        "description": "Overall risk score 0-100"
                    },
                    "risk_level": {
                        "type": "string",
                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                        "description": "Risk level category"
                    },
                    "flags": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "regulation": {"type": "string"},
                                "regulation_name": {"type": "string"},
                                "description": {"type": "string"},
                                "evidence_quote": {"type": "string"},
                                "severity": {"type": "string"}
                            },
                            "required": ["regulation", "regulation_name", "description", "evidence_quote", "severity"]
                        },
                        "description": "Specific regulatory flags with evidence"
                    },
                    "applicable_regulations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "All applicable regulations"
                    },
                    "requires_escalation": {
                        "type": "boolean",
                        "description": "Whether immediate escalation is needed"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Detailed regulatory risk reasoning"
                    }
                },
                "required": ["risk_score", "risk_level", "flags",
                            "applicable_regulations", "requires_escalation", "reasoning"]
            }
        }

    def build_user_message(self, **kwargs) -> str:
        narrative = kwargs.get("narrative", "")
        classification = kwargs.get("classification", {})
        metadata = kwargs.get("metadata", {})

        tags_str = ""
        if metadata.get("tags"):
            tags_str = f"\nSpecial population tags: {', '.join(metadata['tags'])}"

        return f"""Assess the regulatory compliance risk of the following complaint:

COMPLAINT NARRATIVE:
{narrative}

CLASSIFICATION DATA:
- Product: {classification.get('product', 'Unknown')}
- Issue: {classification.get('issue', 'Unknown')}
- Sub-issue: {classification.get('sub_issue', 'Unknown')}
- Severity: {classification.get('severity', 'Unknown')}
- Sentiment: {classification.get('sentiment_score', 'Unknown')}{tags_str}

Analyze this complaint for potential regulatory violations.
Score the overall risk (0-100) and flag specific violations with evidence quotes from the narrative.
Each flag must cite the specific regulation and the exact narrative text that triggers the concern.
Your analysis must be explainable and suitable for regulatory review."""
