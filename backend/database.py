from __future__ import annotations

"""
SQLite database setup and query helpers for the complaint categorization system.
"""
import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Optional

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "complaints.db")


def get_db_path() -> str:
    """Resolve the active SQLite path, overridable for tests and deployments."""
    return os.getenv("OPERON_DB_PATH", DEFAULT_DB_PATH)


def _loads_json(value, default):
    """Safely load a JSON string, falling back to a default value."""
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _latest_analysis_join() -> str:
    """SQL join that selects only the most recent analysis row per complaint."""
    return """
        LEFT JOIN analysis_results ar ON ar.id = (
            SELECT ar2.id
            FROM analysis_results ar2
            WHERE ar2.complaint_id = c.complaint_id
            ORDER BY ar2.id DESC
            LIMIT 1
        )
    """


def get_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(get_db_path(), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database tables."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS complaints (
            complaint_id TEXT PRIMARY KEY,
            narrative TEXT NOT NULL,
            product TEXT,
            channel TEXT DEFAULT 'web',
            customer_state TEXT,
            customer_id TEXT,
            date_received TEXT,
            tags TEXT DEFAULT '[]',
            status TEXT DEFAULT 'received',
            submitted_at TEXT NOT NULL,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT NOT NULL,
            classification_result TEXT,
            compliance_result TEXT,
            routing_result TEXT,
            resolution_result TEXT,
            qa_result TEXT,
            total_processing_time_ms INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            decision TEXT,
            confidence REAL,
            reasoning TEXT,
            evidence_spans TEXT DEFAULT '[]',
            input_summary TEXT,
            output_summary TEXT,
            duration_ms INTEGER,
            FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
        );

        CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
        CREATE INDEX IF NOT EXISTS idx_complaints_date ON complaints(date_received);
        CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
        CREATE INDEX IF NOT EXISTS idx_complaints_channel ON complaints(channel);
        CREATE INDEX IF NOT EXISTS idx_analysis_results_complaint_latest ON analysis_results(complaint_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_complaint ON audit_logs(complaint_id);
        CREATE INDEX IF NOT EXISTS idx_audit_complaint_timestamp ON audit_logs(complaint_id, timestamp ASC);

        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mode TEXT NOT NULL,
            cadence TEXT NOT NULL,
            source_type TEXT NOT NULL,
            payload TEXT DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'active',
            next_run_at TEXT,
            last_run_at TEXT,
            last_run_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedule_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id INTEGER NOT NULL,
            mode TEXT NOT NULL,
            triggered_by TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'running',
            result_summary TEXT DEFAULT '{}',
            processed_count INTEGER NOT NULL DEFAULT 0,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_schedules_status_next_run ON schedules(status, next_run_at);
        CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_id ON schedule_runs(schedule_id, started_at DESC);
    """)

    conn.commit()
    conn.close()


def save_complaint(complaint_id: str, narrative: str, product: Optional[str],
                   channel: str, customer_state: Optional[str],
                   customer_id: Optional[str], date_received: Optional[str],
                   tags: list[str]):
    """Save a new complaint to the database."""
    conn = get_connection()
    conn.execute(
        """INSERT INTO complaints
           (complaint_id, narrative, product, channel, customer_state,
            customer_id, date_received, tags, status, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
           ON CONFLICT(complaint_id) DO UPDATE SET
             narrative = excluded.narrative,
             product = excluded.product,
             channel = excluded.channel,
             customer_state = excluded.customer_state,
             customer_id = COALESCE(excluded.customer_id, complaints.customer_id),
             date_received = COALESCE(excluded.date_received, complaints.date_received),
             tags = excluded.tags
        """,
        (complaint_id, narrative, product, channel, customer_state,
         customer_id, date_received, json.dumps(tags),
         datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def complaint_exists(complaint_id: str) -> bool:
    """Return True when a complaint already exists in the database."""
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM complaints WHERE complaint_id = ? LIMIT 1",
        (complaint_id,),
    ).fetchone()
    conn.close()
    return row is not None


def count_complaints() -> int:
    """Return the total complaint count."""
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) AS count FROM complaints").fetchone()
    conn.close()
    return int(row["count"]) if row else 0


def update_complaint_status(complaint_id: str, status: str):
    """Update complaint processing status."""
    conn = get_connection()
    update_fields = {"status": status}
    if status in ("analyzed", "failed"):
        update_fields["completed_at"] = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE complaints SET status = ?, completed_at = ? WHERE complaint_id = ?",
        (status, update_fields.get("completed_at"), complaint_id)
    )
    conn.commit()
    conn.close()


def save_analysis_result(complaint_id: str, classification: dict,
                         compliance: dict, routing: dict,
                         resolution: dict, qa: dict,
                         total_time_ms: int):
    """Save complete analysis results."""
    conn = get_connection()
    conn.execute(
        """INSERT INTO analysis_results
           (complaint_id, classification_result, compliance_result,
            routing_result, resolution_result, qa_result,
            total_processing_time_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (complaint_id, json.dumps(classification), json.dumps(compliance),
         json.dumps(routing), json.dumps(resolution), json.dumps(qa),
         total_time_ms, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def save_audit_log(complaint_id: str, agent_name: str, decision: str,
                   confidence: Optional[float], reasoning: str,
                   evidence_spans: list[str], input_summary: str,
                   output_summary: str, duration_ms: int):
    """Save an audit trail entry."""
    conn = get_connection()
    conn.execute(
        """INSERT INTO audit_logs
           (complaint_id, agent_name, timestamp, decision, confidence,
            reasoning, evidence_spans, input_summary, output_summary, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (complaint_id, agent_name, datetime.utcnow().isoformat(),
         decision, confidence, reasoning, json.dumps(evidence_spans),
         input_summary, output_summary, duration_ms)
    )
    conn.commit()
    conn.close()


def get_complaint(complaint_id: str) -> Optional[dict]:
    """Get a complaint with its analysis results."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM complaints WHERE complaint_id = ?", (complaint_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None

    complaint = dict(row)
    complaint["tags"] = _loads_json(complaint.get("tags"), [])

    analysis = conn.execute(
        "SELECT * FROM analysis_results WHERE complaint_id = ? ORDER BY id DESC LIMIT 1",
        (complaint_id,)
    ).fetchone()
    analysis_data = dict(analysis) if analysis else {}
    audit_trail = get_audit_trail(complaint_id)

    conn.close()
    return {
        "complaint_id": complaint["complaint_id"],
        "status": complaint["status"],
        "submitted_at": complaint["submitted_at"],
        "completed_at": complaint.get("completed_at"),
        "complaint": {
            "narrative": complaint["narrative"],
            "product": complaint.get("product"),
            "channel": complaint.get("channel", "web"),
            "customer_state": complaint.get("customer_state"),
            "customer_id": complaint.get("customer_id"),
            "date_received": complaint.get("date_received"),
            "tags": complaint.get("tags", []),
        },
        "classification": _loads_json(analysis_data.get("classification_result"), None),
        "compliance_risk": _loads_json(analysis_data.get("compliance_result"), None),
        "routing": _loads_json(analysis_data.get("routing_result"), None),
        "resolution": _loads_json(analysis_data.get("resolution_result"), None),
        "qa_validation": _loads_json(analysis_data.get("qa_result"), None),
        "audit_trail": audit_trail,
        "total_processing_time_ms": analysis_data.get("total_processing_time_ms"),
    }


def get_all_complaints(limit: int = 100, offset: int = 0) -> list[dict]:
    """Get all complaints with basic analysis info."""
    conn = get_connection()
    rows = conn.execute(
        f"""SELECT c.*, ar.classification_result, ar.compliance_result,
                  ar.routing_result, ar.qa_result, ar.total_processing_time_ms
           FROM complaints c
           {_latest_analysis_join()}
           ORDER BY
             CASE
               WHEN c.status = 'analyzed' THEN 0
               WHEN c.status = 'processing' THEN 1
               ELSE 2
             END,
             c.submitted_at DESC
           LIMIT ? OFFSET ?""",
        (limit, offset)
    ).fetchall()

    results = []
    for row in rows:
        r = dict(row)
        r["tags"] = _loads_json(r.get("tags"), [])
        for field in ["classification_result", "compliance_result", "routing_result", "qa_result"]:
            if r.get(field):
                r[field] = _loads_json(r[field], {})
        results.append(r)

    conn.close()
    return results


def get_audit_trail(complaint_id: str) -> list[dict]:
    """Get full audit trail for a complaint."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM audit_logs WHERE complaint_id = ? ORDER BY timestamp ASC",
        (complaint_id,)
    ).fetchall()
    results = []
    for row in rows:
        r = dict(row)
        r["evidence_spans"] = _loads_json(r.get("evidence_spans"), [])
        results.append(r)
    conn.close()
    return results


def get_dashboard_stats() -> dict:
    """Get aggregate statistics for the dashboard."""
    conn = get_connection()

    total = conn.execute("SELECT COUNT(*) as c FROM complaints").fetchone()["c"]
    today = conn.execute(
        "SELECT COUNT(*) as c FROM complaints WHERE date(submitted_at) = date('now')"
    ).fetchone()["c"]

    analyzed = conn.execute(
        "SELECT COUNT(*) as c FROM complaints WHERE status = 'analyzed'"
    ).fetchone()["c"]

    # Product distribution
    product_dist = {}
    rows = conn.execute(
        f"""SELECT ar.classification_result
            FROM complaints c
            {_latest_analysis_join()}
            WHERE ar.id IS NOT NULL"""
    ).fetchall()
    severity_dist = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    risk_dist = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    team_dist = {}
    compliance_flags = 0
    total_time = 0
    time_count = 0

    for row in rows:
        cr = _loads_json(row["classification_result"], {})
        if cr.get("product"):
            product_dist[cr["product"]] = product_dist.get(cr["product"], 0) + 1
        if cr.get("severity"):
            severity_dist[cr["severity"]] = severity_dist.get(cr["severity"], 0) + 1

    # Risk and routing
    rows2 = conn.execute(
        f"""SELECT ar.compliance_result, ar.routing_result, ar.total_processing_time_ms
            FROM complaints c
            {_latest_analysis_join()}
            WHERE ar.id IS NOT NULL"""
    ).fetchall()
    for row in rows2:
        comp = _loads_json(row["compliance_result"], {})
        rout = _loads_json(row["routing_result"], {})
        if comp.get("risk_level"):
            risk_dist[comp["risk_level"]] = risk_dist.get(comp["risk_level"], 0) + 1
        if comp.get("flags"):
            compliance_flags += len(comp["flags"])
        if rout.get("assigned_team"):
            team_dist[rout["assigned_team"]] = team_dist.get(rout["assigned_team"], 0) + 1
        if row["total_processing_time_ms"]:
            total_time += row["total_processing_time_ms"]
            time_count += 1

    avg_time = (total_time / time_count / 1000 / 3600) if time_count > 0 else 0

    conn.close()
    return {
        "total_complaints": total,
        "complaints_today": today,
        "avg_resolution_time_hrs": round(avg_time, 2),
        "compliance_flags_caught": compliance_flags,
        "auto_resolution_rate": round((analyzed / total * 100) if total > 0 else 0, 1),
        "critical_risk_count": risk_dist.get("CRITICAL", 0),
        "high_risk_count": risk_dist.get("HIGH", 0),
        "timely_response_rate": round((analyzed / total * 100) if total > 0 else 0, 1),
        "product_distribution": product_dist,
        "severity_distribution": severity_dist,
        "risk_distribution": risk_dist,
        "team_distribution": team_dist,
    }


def get_dashboard_trends(limit_days: int = 14) -> dict:
    """Get complaint trend data for dashboard charts."""
    conn = get_connection()

    complaints_over_time_rows = conn.execute(
        """
        SELECT date(submitted_at) AS day, COUNT(*) AS count
        FROM complaints
        WHERE date(submitted_at) >= date('now', ?)
        GROUP BY day
        ORDER BY day ASC
        """,
        (f"-{max(limit_days - 1, 0)} days",)
    ).fetchall()

    analysis_rows = conn.execute(
        f"""
        SELECT c.date_received, ar.classification_result, ar.compliance_result,
               ar.routing_result, ar.total_processing_time_ms
        FROM complaints c
        {_latest_analysis_join()}
        WHERE ar.id IS NOT NULL
        ORDER BY c.submitted_at ASC
        """
    ).fetchall()

    product_breakdown = {}
    severity_breakdown = {}
    risk_breakdown = {}
    team_breakdown = {}
    risk_heatmap = {}
    resolution_time_by_product = {}

    for row in analysis_rows:
        classification = _loads_json(row["classification_result"], {})
        compliance = _loads_json(row["compliance_result"], {})
        routing = _loads_json(row["routing_result"], {})

        product = classification.get("product", "Unknown")
        severity = classification.get("severity", "Unknown")
        risk_level = compliance.get("risk_level", "Unknown")
        team = routing.get("assigned_team", "Unassigned")

        product_breakdown[product] = product_breakdown.get(product, 0) + 1
        severity_breakdown[severity] = severity_breakdown.get(severity, 0) + 1
        risk_breakdown[risk_level] = risk_breakdown.get(risk_level, 0) + 1
        team_breakdown[team] = team_breakdown.get(team, 0) + 1

        heatmap_key = (product, risk_level)
        risk_heatmap[heatmap_key] = risk_heatmap.get(heatmap_key, 0) + 1

        if row["total_processing_time_ms"]:
            bucket = resolution_time_by_product.setdefault(product, {"total": 0, "count": 0})
            bucket["total"] += row["total_processing_time_ms"]
            bucket["count"] += 1

    conn.close()

    return {
        "complaints_over_time": [
            {"date": row["day"], "count": row["count"]}
            for row in complaints_over_time_rows
        ],
        "product_breakdown": [
            {"name": name, "value": count}
            for name, count in sorted(product_breakdown.items(), key=lambda item: (-item[1], item[0]))
        ],
        "severity_breakdown": [
            {"name": name, "value": count}
            for name, count in severity_breakdown.items()
        ],
        "risk_breakdown": [
            {"name": name, "value": count}
            for name, count in risk_breakdown.items()
        ],
        "team_breakdown": [
            {"name": name, "value": count}
            for name, count in sorted(team_breakdown.items(), key=lambda item: (-item[1], item[0]))
        ],
        "risk_heatmap": [
            {"product": product, "risk_level": risk_level, "count": count}
            for (product, risk_level), count in sorted(risk_heatmap.items())
        ],
        "resolution_time_by_product": [
            {
                "product": product,
                "hours": round(bucket["total"] / bucket["count"] / 1000 / 3600, 2),
            }
            for product, bucket in sorted(resolution_time_by_product.items(), key=lambda item: item[0])
        ],
    }


def _parse_schedule(row: sqlite3.Row | None) -> Optional[dict]:
    if not row:
        return None
    item = dict(row)
    item["payload"] = _loads_json(item.get("payload"), {})
    return item


def _parse_schedule_run(row: sqlite3.Row | None) -> Optional[dict]:
    if not row:
        return None
    item = dict(row)
    item["result_summary"] = _loads_json(item.get("result_summary"), {})
    return item


def list_schedules(limit: int = 100, offset: int = 0) -> list[dict]:
    """Return persisted schedules ordered by most recently updated."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT *
        FROM schedules
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    ).fetchall()
    conn.close()
    return [_parse_schedule(row) for row in rows]


def get_schedule(schedule_id: int) -> Optional[dict]:
    """Return a single schedule by id."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM schedules WHERE id = ?",
        (schedule_id,),
    ).fetchone()
    conn.close()
    return _parse_schedule(row)


def get_schedule_by_name(name: str) -> Optional[dict]:
    """Return a single schedule by its unique display name."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM schedules WHERE name = ? ORDER BY id DESC LIMIT 1",
        (name,),
    ).fetchone()
    conn.close()
    return _parse_schedule(row)


def create_schedule(
    name: str,
    mode: str,
    cadence: str,
    source_type: str,
    payload: dict[str, Any],
    status: str = "active",
    next_run_at: Optional[str] = None,
) -> dict:
    """Persist a new schedule definition and return it."""
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO schedules
        (name, mode, cadence, source_type, payload, status, next_run_at, last_run_at, last_run_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)
        """,
        (name, mode, cadence, source_type, json.dumps(payload or {}), status, next_run_at, now, now),
    )
    schedule_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_schedule(schedule_id)


def update_schedule(
    schedule_id: int,
    *,
    name: Optional[str] = None,
    cadence: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    status: Optional[str] = None,
    next_run_at: Optional[str] = None,
    last_run_at: Optional[str] = None,
    last_run_count: Optional[int] = None,
) -> Optional[dict]:
    """Update a schedule definition and return the fresh row."""
    fields: list[str] = []
    values: list[Any] = []

    if name is not None:
        fields.append("name = ?")
        values.append(name)
    if cadence is not None:
        fields.append("cadence = ?")
        values.append(cadence)
    if payload is not None:
        fields.append("payload = ?")
        values.append(json.dumps(payload))
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if next_run_at is not None:
        fields.append("next_run_at = ?")
        values.append(next_run_at)
    if last_run_at is not None:
        fields.append("last_run_at = ?")
        values.append(last_run_at)
    if last_run_count is not None:
        fields.append("last_run_count = ?")
        values.append(last_run_count)

    fields.append("updated_at = ?")
    values.append(datetime.utcnow().isoformat())
    values.append(schedule_id)

    conn = get_connection()
    conn.execute(
        f"UPDATE schedules SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    conn.commit()
    conn.close()
    return get_schedule(schedule_id)


def delete_schedule(schedule_id: int) -> bool:
    """Delete a schedule and its historical runs."""
    conn = get_connection()
    conn.execute("DELETE FROM schedule_runs WHERE schedule_id = ?", (schedule_id,))
    cursor = conn.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_due_schedules(now_iso: str) -> list[dict]:
    """Return all active schedules whose next_run_at is due."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT *
        FROM schedules
        WHERE status = 'active'
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
        ORDER BY next_run_at ASC, id ASC
        """,
        (now_iso,),
    ).fetchall()
    conn.close()
    return [_parse_schedule(row) for row in rows]


def create_schedule_run(schedule_id: int, mode: str, triggered_by: str) -> int:
    """Create a schedule run row in running state and return its id."""
    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO schedule_runs
        (schedule_id, mode, triggered_by, status, result_summary, processed_count, started_at, completed_at)
        VALUES (?, ?, ?, 'running', '{}', 0, ?, NULL)
        """,
        (schedule_id, mode, triggered_by, datetime.utcnow().isoformat()),
    )
    run_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return run_id


def complete_schedule_run(
    run_id: int,
    *,
    status: str,
    processed_count: int,
    result_summary: dict[str, Any],
) -> Optional[dict]:
    """Finish a schedule run and return the updated row."""
    completed_at = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute(
        """
        UPDATE schedule_runs
        SET status = ?, processed_count = ?, result_summary = ?, completed_at = ?
        WHERE id = ?
        """,
        (status, processed_count, json.dumps(result_summary or {}), completed_at, run_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM schedule_runs WHERE id = ?", (run_id,)).fetchone()
    conn.close()
    return _parse_schedule_run(row)


def list_schedule_runs(schedule_id: int, limit: int = 20) -> list[dict]:
    """Return recent run history for a schedule."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT *
        FROM schedule_runs
        WHERE schedule_id = ?
        ORDER BY started_at DESC, id DESC
        LIMIT ?
        """,
        (schedule_id, limit),
    ).fetchall()
    conn.close()
    return [_parse_schedule_run(row) for row in rows]


def fail_running_schedule_runs() -> int:
    """Mark orphaned running schedule runs as failed during startup."""
    conn = get_connection()
    cursor = conn.execute(
        """
        UPDATE schedule_runs
        SET status = 'failed',
            result_summary = ?,
            completed_at = ?
        WHERE status = 'running'
        """,
        (json.dumps({"error": "Marked failed during startup recovery"}), datetime.utcnow().isoformat()),
    )
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count
