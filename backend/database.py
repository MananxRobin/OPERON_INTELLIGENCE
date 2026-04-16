"""
SQLite database setup and query helpers for the complaint categorization system.
"""
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "complaints.db")


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
            ORDER BY ar2.created_at DESC, ar2.id DESC
            LIMIT 1
        )
    """


def get_connection():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize database tables."""
    conn = get_connection()
    cursor = conn.cursor()

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
        CREATE INDEX IF NOT EXISTS idx_audit_complaint ON audit_logs(complaint_id);
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
        """INSERT OR REPLACE INTO complaints
           (complaint_id, narrative, product, channel, customer_state,
            customer_id, date_received, tags, status, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)""",
        (complaint_id, narrative, product, channel, customer_state,
         customer_id, date_received, json.dumps(tags),
         datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


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
        "SELECT * FROM analysis_results WHERE complaint_id = ? ORDER BY created_at DESC LIMIT 1",
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
           ORDER BY c.submitted_at DESC
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
