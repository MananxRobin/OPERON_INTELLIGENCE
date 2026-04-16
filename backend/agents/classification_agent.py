"""
Classification Agent — Classifies complaints by product, issue, severity, and sentiment.
"""
from backend.agents.base_agent import BaseAgent


class ClassificationAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "ClassificationAgent"

    @property
    def system_prompt(self) -> str:
        return """You are an expert financial complaint classification agent for a national fintech company.

Your job is to analyze consumer complaint narratives and extract structured classification data.

PRODUCT CATEGORIES (choose one):
- Credit card
- Personal loan
- Vehicle loan
- Mortgage
- Home equity loan
- Student loan
- Checking account
- Savings account
- Debt collection
- Money transfer
- Prepaid card

SEVERITY LEVELS:
- CRITICAL: Immediate financial harm, legal threats, potential regulatory violation, elder/servicemember abuse
- HIGH: Significant financial impact, repeated failures, compliance risk
- MEDIUM: Moderate inconvenience, standard dispute, single failure
- LOW: Minor issue, informational complaint, easily resolved

You must provide a clear reasoning chain explaining your classification decisions.
Extract key entities (dollar amounts, dates, names, account references) from the narrative.
Assess sentiment on a scale from -1.0 (extremely negative) to 1.0 (positive).
Rate your classification confidence from 0.0 to 1.0."""

    @property
    def output_tool(self) -> dict:
        return {
            "name": "classify_complaint",
            "description": "Classify a consumer financial complaint by product, issue, severity, and sentiment.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "product": {
                        "type": "string",
                        "description": "Financial product category"
                    },
                    "sub_product": {
                        "type": "string",
                        "description": "Specific product subcategory"
                    },
                    "issue": {
                        "type": "string",
                        "description": "Primary complaint issue"
                    },
                    "sub_issue": {
                        "type": "string",
                        "description": "Specific sub-issue detail"
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                        "description": "Severity level"
                    },
                    "sentiment_score": {
                        "type": "number",
                        "description": "Sentiment from -1.0 (very negative) to 1.0 (positive)"
                    },
                    "urgency": {
                        "type": "string",
                        "description": "Urgency assessment"
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Classification confidence 0.0 to 1.0"
                    },
                    "key_entities": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key entities extracted: amounts, dates, names"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Detailed explanation of classification reasoning"
                    }
                },
                "required": ["product", "sub_product", "issue", "sub_issue",
                            "severity", "sentiment_score", "urgency",
                            "confidence", "key_entities", "reasoning"]
            }
        }

    def build_user_message(self, **kwargs) -> str:
        narrative = kwargs.get("narrative", "")
        metadata = kwargs.get("metadata", {})

        meta_str = ""
        if metadata:
            if metadata.get("product"):
                meta_str += f"\nPre-labeled product: {metadata['product']}"
            if metadata.get("channel"):
                meta_str += f"\nChannel: {metadata['channel']}"
            if metadata.get("customer_state"):
                meta_str += f"\nCustomer state: {metadata['customer_state']}"
            if metadata.get("tags"):
                meta_str += f"\nSpecial tags: {', '.join(metadata['tags'])}"

        return f"""Analyze and classify the following consumer complaint:

COMPLAINT NARRATIVE:
{narrative}

METADATA:{meta_str if meta_str else " None provided"}

Classify this complaint by product, issue type, severity, sentiment, and urgency.
Extract all key entities (dollar amounts, dates, account details).
Provide detailed reasoning for your classification."""
