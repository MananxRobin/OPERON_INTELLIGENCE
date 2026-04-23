"""
Base agent class for OpenAI-powered complaint analysis agents.
Handles API communication, structured output parsing, and audit logging.
"""
import asyncio
import json
import time
from abc import ABC, abstractmethod
from typing import Any
import httpx
from backend.database import save_audit_log


class BaseAgent(ABC):
    """Abstract base class for all complaint analysis agents."""

    def __init__(self, client: httpx.Client, model: str = "gpt-5.4-mini"):
        self.client = client
        self.model = model

    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Unique name for this agent."""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """System prompt for this agent."""
        pass

    @property
    @abstractmethod
    def output_tool(self) -> dict:
        """Tool definition for structured output."""
        pass

    def build_user_message(self, **kwargs) -> str:
        """Build the user message for this agent. Override in subclasses."""
        raise NotImplementedError

    def normalize_result(self, result: dict) -> dict:
        """Coerce model output into the expected shape for downstream agents."""
        return result

    async def run(self, complaint_id: str, **kwargs) -> dict:
        """
        Execute the agent: call OpenAI, parse output, log audit trail.
        Returns the structured result dict.
        """
        start_time = time.time()

        user_message = self.build_user_message(**kwargs)

        try:
            result = await asyncio.to_thread(self._request_structured_output, user_message)

            duration_ms = int((time.time() - start_time) * 1000)

            # Log audit trail
            save_audit_log(
                complaint_id=complaint_id,
                agent_name=self.agent_name,
                decision=self._summarize_decision(result),
                confidence=result.get("confidence"),
                reasoning=result.get("reasoning", ""),
                evidence_spans=result.get("evidence_spans", result.get("key_entities", [])),
                input_summary=user_message[:500],
                output_summary=json.dumps(result)[:1000],
                duration_ms=duration_ms
            )

            result["_duration_ms"] = duration_ms
            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            save_audit_log(
                complaint_id=complaint_id,
                agent_name=self.agent_name,
                decision=f"ERROR: {str(e)}",
                confidence=0.0,
                reasoning=f"Agent failed with error: {str(e)}",
                evidence_spans=[],
                input_summary=user_message[:500] if 'user_message' in dir() else "",
                output_summary="",
                duration_ms=duration_ms
            )
            raise

    def _request_structured_output(self, user_message: str) -> dict:
        """Call the configured chat completions backend with JSON output mode."""
        schema = self.output_tool.get("input_schema", {})
        expected_keys = list((schema.get("properties") or {}).keys())
        expected_hint = ", ".join(expected_keys)

        system_prompt = (
            f"{self.system_prompt}\n\n"
            "Return only one valid JSON object as the final answer. "
            "Do not use markdown fences. "
            f"The JSON object must include these keys: {expected_hint}."
        )
        user_prompt = (
            f"{user_message}\n\n"
            "Output format requirement: respond with a JSON object only."
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        if self.model.startswith("gpt-5"):
            payload["max_completion_tokens"] = 8192
        else:
            payload["max_tokens"] = 8192
        payload["temperature"] = 0.1

        last_error: Exception | None = None
        for _ in range(2):
            try:
                response = self.client.post("chat/completions", json=payload)
                response.raise_for_status()
                data = response.json()

                choices = data.get("choices", [])
                if not choices:
                    raise ValueError(f"No choices returned from {self.agent_name}")

                message: dict[str, Any] = choices[0].get("message", {}) or {}
                content = message.get("content", "")
                if not content:
                    raise ValueError(f"No content returned from {self.agent_name}")

                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

                return self.normalize_result(json.loads(cleaned))
            except Exception as exc:
                last_error = exc

        raise ValueError(f"{self.agent_name} failed to return valid JSON: {last_error}")

    def _to_strict_json_schema(self, schema: dict) -> dict:
        """Recursively adapt a JSON schema to OpenAI Structured Outputs strict mode."""
        if not isinstance(schema, dict):
            return schema

        converted = {}
        for key, value in schema.items():
            if key == "properties" and isinstance(value, dict):
                converted[key] = {
                    prop_name: self._to_strict_json_schema(prop_schema)
                    for prop_name, prop_schema in value.items()
                }
            elif key == "items":
                converted[key] = self._to_strict_json_schema(value)
            else:
                converted[key] = self._to_strict_json_schema(value) if isinstance(value, dict) else (
                    [self._to_strict_json_schema(item) for item in value]
                    if isinstance(value, list)
                    else value
                )

        if converted.get("type") == "object":
            converted.setdefault("additionalProperties", False)

        return converted

    def _summarize_decision(self, result: dict) -> str:
        """Create a human-readable summary of the agent's decision."""
        return json.dumps({k: v for k, v in result.items()
                          if k not in ("reasoning", "evidence_spans", "key_entities",
                                       "_duration_ms", "action_plan", "customer_response",
                                       "internal_notes", "checks")}, default=str)[:500]
