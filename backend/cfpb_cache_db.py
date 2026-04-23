from __future__ import annotations

"""Separate SQLite cache for raw CFPB complaint data used by Synopsis."""

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Optional

DEFAULT_CFPB_DB_PATH = os.path.join(os.path.dirname(__file__), "cfpb_cache.db")


def get_cfpb_db_path() -> str:
    return os.getenv("OPERON_CFPB_DB_PATH", DEFAULT_CFPB_DB_PATH)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_cfpb_db_path(), timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def _loads_json(value: Optional[str], default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def init_cfpb_cache_db() -> None:
    conn = get_connection()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS cfpb_complaints (
            complaint_id TEXT PRIMARY KEY,
            date_received TEXT,
            date_sent_to_company TEXT,
            product TEXT,
            sub_product TEXT,
            issue TEXT,
            sub_issue TEXT,
            company TEXT,
            state TEXT,
            zip_code TEXT,
            submitted_via TEXT,
            tags TEXT DEFAULT '[]',
            complaint_what_happened TEXT,
            consumer_consent_provided TEXT,
            company_response TEXT,
            company_public_response TEXT,
            timely TEXT,
            consumer_disputed TEXT,
            raw_payload TEXT DEFAULT '{}',
            fetched_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cfpb_cache_date_received ON cfpb_complaints(date_received DESC);
        CREATE INDEX IF NOT EXISTS idx_cfpb_cache_company ON cfpb_complaints(company);
        CREATE INDEX IF NOT EXISTS idx_cfpb_cache_product ON cfpb_complaints(product);
        CREATE INDEX IF NOT EXISTS idx_cfpb_cache_state ON cfpb_complaints(state);
        CREATE INDEX IF NOT EXISTS idx_cfpb_cache_fetched_at ON cfpb_complaints(fetched_at DESC);
        """
    )
    conn.commit()
    conn.close()


def upsert_cfpb_complaints(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0

    now_iso = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.executemany(
        """
        INSERT INTO cfpb_complaints (
            complaint_id,
            date_received,
            date_sent_to_company,
            product,
            sub_product,
            issue,
            sub_issue,
            company,
            state,
            zip_code,
            submitted_via,
            tags,
            complaint_what_happened,
            consumer_consent_provided,
            company_response,
            company_public_response,
            timely,
            consumer_disputed,
            raw_payload,
            fetched_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(complaint_id) DO UPDATE SET
            date_received = excluded.date_received,
            date_sent_to_company = excluded.date_sent_to_company,
            product = excluded.product,
            sub_product = excluded.sub_product,
            issue = excluded.issue,
            sub_issue = excluded.sub_issue,
            company = excluded.company,
            state = excluded.state,
            zip_code = excluded.zip_code,
            submitted_via = excluded.submitted_via,
            tags = excluded.tags,
            complaint_what_happened = excluded.complaint_what_happened,
            consumer_consent_provided = excluded.consumer_consent_provided,
            company_response = excluded.company_response,
            company_public_response = excluded.company_public_response,
            timely = excluded.timely,
            consumer_disputed = excluded.consumer_disputed,
            raw_payload = excluded.raw_payload,
            fetched_at = excluded.fetched_at,
            updated_at = excluded.updated_at
        """,
        [
            (
                row["complaint_id"],
                row.get("date_received"),
                row.get("date_sent_to_company"),
                row.get("product"),
                row.get("sub_product"),
                row.get("issue"),
                row.get("sub_issue"),
                row.get("company"),
                row.get("state"),
                row.get("zip_code"),
                row.get("submitted_via"),
                json.dumps(row.get("tags") or []),
                row.get("complaint_what_happened"),
                row.get("consumer_consent_provided"),
                row.get("company_response"),
                row.get("company_public_response"),
                row.get("timely"),
                row.get("consumer_disputed"),
                json.dumps(row),
                now_iso,
                now_iso,
            )
            for row in rows
        ],
    )
    conn.commit()
    conn.close()
    return len(rows)


def count_cached_cfpb_complaints() -> int:
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) AS count FROM cfpb_complaints").fetchone()
    conn.close()
    return int(row["count"]) if row else 0


def latest_cached_cfpb_date_received() -> Optional[str]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT date_received
        FROM cfpb_complaints
        WHERE date_received IS NOT NULL AND date_received != ''
        ORDER BY date_received DESC
        LIMIT 1
        """
    ).fetchone()
    conn.close()
    return str(row["date_received"]) if row and row["date_received"] else None


def latest_cached_cfpb_fetch_time() -> Optional[str]:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT fetched_at
        FROM cfpb_complaints
        ORDER BY fetched_at DESC
        LIMIT 1
        """
    ).fetchone()
    conn.close()
    return str(row["fetched_at"]) if row and row["fetched_at"] else None


def list_cached_cfpb_complaints(
    *,
    limit: int = 500,
    offset: int = 0,
    date_received_min: Optional[str] = None,
) -> list[dict[str, Any]]:
    conn = get_connection()
    where = ""
    params: list[Any] = []
    if date_received_min:
        where = "WHERE COALESCE(date_received, substr(fetched_at, 1, 10)) >= ?"
        params.append(date_received_min)

    rows = conn.execute(
        f"""
        SELECT *
        FROM cfpb_complaints
        {where}
        ORDER BY COALESCE(date_received, substr(fetched_at, 1, 10)) DESC, fetched_at DESC
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    conn.close()

    parsed: list[dict[str, Any]] = []
    for row in rows:
        parsed.append(
            {
                "complaint_id": row["complaint_id"],
                "date_received": row["date_received"],
                "date_sent_to_company": row["date_sent_to_company"],
                "product": row["product"],
                "sub_product": row["sub_product"],
                "issue": row["issue"],
                "sub_issue": row["sub_issue"],
                "company": row["company"],
                "state": row["state"],
                "zip_code": row["zip_code"],
                "submitted_via": row["submitted_via"],
                "tags": _loads_json(row["tags"], []),
                "complaint_what_happened": row["complaint_what_happened"],
                "consumer_consent_provided": row["consumer_consent_provided"],
                "company_response": row["company_response"],
                "company_public_response": row["company_public_response"],
                "timely": row["timely"],
                "consumer_disputed": row["consumer_disputed"],
                "raw_payload": _loads_json(row["raw_payload"], {}),
                "fetched_at": row["fetched_at"],
                "updated_at": row["updated_at"],
            }
        )
    return parsed
